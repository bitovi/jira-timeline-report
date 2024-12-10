interface JiraLocationState {
  key: string;
  hash: string | null;
  query?: Record<string, string> | null;
  state?: Record<string, string> | null; 
  title: string;
  href: string;
}

interface JiraPushLocationState extends Omit<JiraLocationState, 'query'> {
  query?: Record<string, string | null> | null;
}

type CanPatch = {
  type: 'add' | 'set';
  key: string;
  value: any;
} | {
  type: 'delete';
  key: string;
}

declare global {
  interface AP {
    history: {
      getState: <T extends 'all' | 'hash'>(
        type?: T,
        callback?: (state: JiraLocationState) => void
      ) => (T extends 'all' ? JiraLocationState : string);
      replaceState: (state: Partial<JiraPushLocationState>) => void;
      subscribeState: (type: string, callback: (state: JiraLocationState) => void) => void;
    }
  }
}

const isValueLikeSymbol = Symbol.for("can.isValueLike");
const isMapLikeSymbol = Symbol.for("can.isMapLike");
const onKeyValueSymbol = Symbol.for("can.onKeyValue");
const offKeyValueSymbol = Symbol.for("can.offKeyValue");
const getKeyValueSymbol = Symbol.for("can.getKeyValue");
const setKeyValueSymbol = Symbol.for("can.setKeyValue");

const onPatchesSymbol = Symbol.for("can.onPatches");
const offPatchesSymbol = Symbol.for("can.offPatches");

type KeyHandler = (newValue: any, oldValue: any) => void;
export interface JiraStateSync {
  [onKeyValueSymbol]: (key: string, handler: KeyHandler, queue?: string) => void;
  [offKeyValueSymbol]: (key: string, handler: KeyHandler, queue?: string) => void;
  [onPatchesSymbol]: (handler: KeyHandler, queue?: string) => void;
  [offPatchesSymbol]: (handler: KeyHandler, queue?: string) => void;
  [getKeyValueSymbol]: (key: string) => string | undefined;
  [setKeyValueSymbol]: (key: string, value: string | null) => void;
  [isMapLikeSymbol]: true,
  [isValueLikeSymbol]: true,
  on: (key: string | undefined, handler: KeyHandler, queue?: string) => void;
  off: (key: string | undefined, handler: KeyHandler, queue?: string) => void;
  get: <T extends string | undefined> (key: T) => T extends string ? (string | undefined) : Record<string, string | null>;
  set: (...args: [string, string | null] | [state: Record<string, string | null>]) => void;
}

const handlers = new Map<string, Set<KeyHandler>>();
const patchHandlers = new Map<Function, KeyHandler>();
const valueHandlers = new Set<KeyHandler>();
let lastQuery: Record<string, string> | null = null;

const stateApi: Pick<JiraStateSync, 'on' | 'off' | 'get' | 'set'> = {
  on: function(key, handler, queue) {
    if (!key) {
      valueHandlers.add(handler);
    } else if (key === 'can.patches') {
      patchHandlers.set(handler, (patches) => {
        if (patches.length) {
          handler(patches, undefined);
        }
      })
    } else if (handlers.has(key)) {
      const keyHandlers = handlers.get(key)!;
      keyHandlers.add(handler);
    } else {
      const handlerSet = new Set<KeyHandler>();
      handlerSet.add(handler);
      handlers.set(key, handlerSet);
    }
  },
  off: function(key, handler, queue) {
    if (!key) {
      valueHandlers.delete(handler);
    } else if (key === 'can.patches') {
      patchHandlers.delete(handler);
    } else if (handlers.has(key)) {
      const keyHandlers = handlers.get(key)!;
      keyHandlers.delete(handler);
    }
  },
  get: function(key?: string) {
    const encodedVal = decodeQuery(AP?.history.getState('all').query);
    if (arguments.length > 0) {
      return encodedVal?.[key!];
    } else {
      return encodedVal ?? {};
    }
  } as JiraStateSync['get'],
  set(...args) {
    const [keyOrState, val] = args;
    const { query: currentState = {} } = AP?.history.getState('all') ?? {};
    let newState: Record<string, string | null>;
    if (typeof keyOrState === 'string') {
      newState = {
        ...currentState,
        [keyOrState]: val ? encodeURIComponent(val) : null,
      };
    } else {
      const changedState = encodeQuery(keyOrState);

      newState = {
        ...currentState,
        ...changedState as Record<string, string | null>,
      };
    }
    if (Object.keys(newState).reduce((a, b) => a && (newState[b] === currentState?.[b]), true)) {
      // no keys have changed.
      // Do not dispatch a new state to the AP history
      return;
    }

    AP?.history.replaceState({ query: newState })
  }
}

const dispatchKeyHandlers: (key: string, newValue?: string | null, oldValue?: string | null) => void = (key, newValue, oldValue) => {
  const keyHandlers = handlers.get(key);
  if(keyHandlers) {
    keyHandlers.forEach(handler => {
      handler(newValue, oldValue);
    })
  }
}

const decodeQuery = (
  query?: Record<string, string> | null
): Record<string, string | null> =>
  Object.entries(query ?? {}).reduce(
    (a, [key, val]) => ({ ...a, [key]: val ? decodeURIComponent(val) : val }),
    {}
  );
const encodeQuery = (
  query?: Record<string, string | null> | null
) =>
  Object.entries(query ?? {}).reduce(
    (a, [key, val]) => ({ ...a, [key]: val ? encodeURIComponent(val) : null }),
    {}
  ) as Record<string, string | null>;

export const browserState: JiraStateSync = {
  ...stateApi,
  [onKeyValueSymbol]: stateApi.on,
  [offKeyValueSymbol]: stateApi.off,
  [onPatchesSymbol]: stateApi.on.bind(null, 'can.patches'),
  [offPatchesSymbol]: stateApi.off.bind(null, 'can.patches'),
  [getKeyValueSymbol]: stateApi.get,
  [setKeyValueSymbol]: stateApi.set as JiraStateSync[typeof setKeyValueSymbol],
  [isValueLikeSymbol]: true,
  [isMapLikeSymbol]: true,
};

AP?.history?.subscribeState("change", ({ query }: { query?: Record<string, string> | null; }) => {
  if (!lastQuery && !query) {
    return;
  }

  const decodedQuery = decodeQuery(query);

  if (query) {
    Object.entries(decodedQuery).forEach(([key, val]) => {
      if (val !== lastQuery?.[key]) {
        dispatchKeyHandlers(key, val, lastQuery?.[key]);
      }
    });
  }
  if (patchHandlers.size > 0) {
    const patches = [];
    if (lastQuery == null) {
      const newEntries = Object.entries(decodedQuery);
      patches.push(...newEntries.map(([key, val]) => ({ key, type: 'add', value: val })));
    } else if (query == null) {
      const oldEntries = Object.entries(lastQuery);
      patches.push(...oldEntries.map(([key]) => ({ key, type: 'delete' })));
    } else {
      const newKeys = Object.keys(decodedQuery);
      const oldKeys = Object.keys(lastQuery);
      const adds = newKeys.filter(key => !oldKeys.includes(key));
      const dels = oldKeys.filter(key => !newKeys.includes(key));
      const sets = newKeys.filter(key => !adds.includes(key));

      patches.push(
        ...dels.map(key => ({ type: 'delete', key })),
        ...sets.filter(key => query[key] !== lastQuery?.[key]).map(key => ({ type: 'set', key, value: decodedQuery[key] })),
        ...adds.map(key => ({ type: 'add', key, value: decodedQuery[key] })),
      );
    }
    for(const handler of patchHandlers.values()) {
      handler(patches, undefined);
    };
  }
  // Value handlers are dispatched after patch handlers
  //  because the local URL is being updated by a patch 
  //  handler, while the observables looking at the URL
  //  are using listenTo() which relies on value handlers
  valueHandlers.forEach(handler => {
    handler(query ? decodedQuery : query, lastQuery);
  });

  lastQuery = query ?? null;
});
export default browserState;

// This listener keeps the frame URL search in sync with
// the outer page's `ac` params, allowing our existing
// observables to continue using the interior URL for 
// values.
browserState.on('can.patches', (patches: CanPatch[]) => {
  const currentParams = new URLSearchParams(location.search);

  patches.forEach((patch) => {
    if (patch.type === 'delete') {
      currentParams.delete(patch.key);
    } else {
      currentParams.set(patch.key, patch.value);
    }
  })

  history.pushState({}, '', `?${currentParams.toString()}`);
});

const keyblocklist = [
  "xdm_e",
  "xdm_c",
  "cp",
  "xdm_deprecated_addon_key_do_not_use",
  "lic",
  "cv",
];
window.addEventListener('popstate', () => {
  const { search } = window.location;
  const searchState = encodeQuery(
    Array.from(new URLSearchParams(search).entries()).filter(([key]) => !keyblocklist.includes(key)).reduce(
      (a, [key, val]) => ({ ...a, [key]: val })
      , {})
    );
  AP?.history.replaceState(searchState);
});

AP?.history?.getState('all', ({ query }) => {
  const decodedQuery = decodeQuery(query);
  const currentParams = new URLSearchParams(location.search);
  Object.entries(decodedQuery).forEach(([key, val]) => {
    currentParams.set(key, val!);
  });

  history.replaceState({}, '', `?${currentParams.toString()}`);
});

export const underlyingReplaceState = history.replaceState;
export const pushStateObservable = browserState;
