import { deparam as _deparam } from "../../can";
const deparam = _deparam as (params?: string | null) => Record<string, string>;

interface JiraLocationState {
  key: string;
  hash: string | null;
  query?: {
    state?: string;
  };
  state?: Record<string, string> | null; 
  title: string;
  href: string;
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
      replaceState: (state: Partial<JiraLocationState>) => void;
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
  get: <T extends string | undefined> (key: T) => T extends string ? (string | undefined) : Record<string, string>;
  set: (...args: [string] | [string, string | null] | [state: Record<string, string | null>]) => void;
  value: string;
}

const handlers = new Map<string, Set<KeyHandler>>();
const patchHandlers = new Map<Function, KeyHandler>();
const valueHandlers = new Set<KeyHandler>();
let lastQuery: Record<string, string> | null = null;
let disablePushState = false;

const searchParamsToObject = (params: URLSearchParams) => (
  Array.from(params.entries()).reduce((a, [key, val]) => ({ ...a, [key]: val }), {})
);

const stateApi: Pick<JiraStateSync, 'on' | 'off' | 'get' | 'set' | 'value'> = {
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
    const params = new URLSearchParams(decodeURIComponent(AP?.history.getState('all').query?.state ?? ''));
    if (arguments.length > 0) {
      return params.get(key!);
    } else {
      return searchParamsToObject(params);
    }
  } as JiraStateSync['get'],
  set(...args) {
    const [keyOrState, val] = args;
    const { query } = AP?.history.getState('all') ?? {};
    const { state: currentState = '' } = query ?? {};
    const currentParams = deparam(decodeURIComponent(currentState));
    let newParams: Record<string, string> = { ...currentParams };
    let newState: string;

    if (typeof keyOrState === 'string') {
      if (args.length === 1) {
        // urlData form, assume that the set() is for the full URL string.
        newParams = deparam(keyOrState) as Record<string, string>;
      } else if (val == null) {
        delete newParams[keyOrState];
      } else {
        newParams[keyOrState] = val;
      }
    } else {
      Object.entries(keyOrState).forEach(([key, val]) => {
        if(val == null) {
          delete newParams[key];
        } else {
          newParams[key] = val;
        }
      });
    }
    if (
      Object.keys(newParams)
      .concat(Object.keys(currentParams))
      .reduce((a, b) => a && (newParams[b] === currentParams?.[b]), true)
    ) {
      // no keys have changed.
      // Do not dispatch a new state to the AP history
      return;
    }
    const newURLParams = new URLSearchParams(newParams);
    newURLParams.sort();

    AP?.history.replaceState({
      query: { state: encodeURIComponent(newURLParams.toString()) },
      state: { fromPopState: 'false' }
    })
  },
  get value() {
    const params = this.get(undefined);
    const searchString = new URLSearchParams(params);
    searchString.sort();
    return searchString.toString();
  },
  set value(params: string) {
    this.set(params);
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

AP?.history?.subscribeState("change", ({ query, state }: JiraLocationState) => {
  if (!lastQuery && !query) {
    return;
  }
  const decodedQuery = decodeURIComponent(query?.state ?? '');
  const queryParams = deparam(decodedQuery);

  // if we popped the state to get the new state, don't push yet another new state on the history
  disablePushState = state?.fromPopState === 'true';

  if (query?.state) {
    Object.entries(queryParams).forEach(([key, val]) => {
      if (val !== lastQuery?.[key]) {
        dispatchKeyHandlers(key, val, lastQuery?.[key]);
      }
    });
  } else {
    Object.entries(lastQuery ?? {}).forEach(([key, lastVal]) => {
      if (lastVal !== undefined) {
        dispatchKeyHandlers(key, undefined, lastVal);
      }
    });    
  }
  if (patchHandlers.size > 0) {
    const patches = [];
    if (lastQuery == null) {
      const newEntries = Object.entries(queryParams);
      patches.push(...newEntries.map(([key, val]) => ({ key, type: 'add', value: val })));
    } else if (query == null) {
      const oldEntries = Object.entries(lastQuery);
      patches.push(...oldEntries.map(([key]) => ({ key, type: 'delete' })));
    } else {
      const newKeys = Object.keys(queryParams);
      const oldKeys = Object.keys(lastQuery);
      const adds = newKeys.filter(key => !oldKeys.includes(key));
      const dels = oldKeys.filter(key => !newKeys.includes(key));
      const sets = newKeys.filter(key => !adds.includes(key));

      patches.push(
        ...dels.map(key => ({ type: 'delete', key })),
        ...sets.filter(key => queryParams[key] !== lastQuery?.[key]).map(key => ({ type: 'set', key, value: queryParams[key] })),
        ...adds.map(key => ({ type: 'add', key, value: queryParams[key] })),
      );
    }
    for(const handler of patchHandlers.values()) {
      handler(patches, undefined);
    };

    disablePushState = false;
  }
  // Value handlers are dispatched after patch handlers
  //  because the local URL is being updated by a patch 
  //  handler, while the observables looking at the URL
  //  are using listenTo() which relies on value handlers
  const lastQueryParams = new URLSearchParams(lastQuery ?? {});
  lastQueryParams.sort();
  const lastQueryString = lastQueryParams.toString();
  valueHandlers.forEach(handler => {
    handler(decodedQuery, lastQueryParams);
  });

  lastQuery = decodedQuery ? queryParams : null;
});
export default browserState;

const keyblocklist = [
  "xdm_e",
  "xdm_c",
  "cp",
  "xdm_deprecated_addon_key_do_not_use",
  "lic",
  "cv",
];
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
  currentParams.sort();
  const paramString = currentParams.toString();
  keyblocklist.forEach(key => currentParams.delete(key));

  if (!disablePushState) {
    history.pushState(searchParamsToObject(currentParams), '', `?${paramString}`);
  }
});

window.addEventListener('popstate', () => {
  const { search } = window.location;
  const searchParams = new URLSearchParams(search);
  searchParams.sort();
  keyblocklist.forEach(key => searchParams.delete(key));

  AP?.history.replaceState({ query: { state: encodeURIComponent(searchParams.toString()) }, state: { fromPopState: 'true' }});
});

AP?.history?.getState('all', ({ query }) => {
  const newState = decodeURIComponent(query?.state ?? '')
  history.pushState(deparam(newState), '', `?${newState}`);
  valueHandlers.forEach(handler => {
    handler(newState, undefined);
  });
});

export const underlyingReplaceState = history.replaceState;
export const pushStateObservable = browserState;
