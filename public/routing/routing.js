export function beforeCanRouteIsCalled() {
  if (!window?.AP?.history.getState) {
    return;
  }

  history.replaceState(
    null,
    "",
    "?" + objectToQueryString(window?.AP?.history.getState("all")?.query ?? {})
  );
}

export function initialize() {
  if (!window?.AP?.history.getState) {
    return;
  }

  const originalPushState = history.pushState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);

    AP?.history.replaceState({
      query: queryStringToObject(window.location.search),
      state: { fromPopState: "false" },
    });
  };

  addEventListener("popstate", function (...args) {
    console.log("popstate", args);
  });

  // setInterval(function () {
  //   document.querySelector("nav").innerHTML = window.location.search.toString();
  // }, 200);
}

function queryStringToObject(queryString) {
  const params = new URLSearchParams(queryString);
  const result = {};

  for (const [key, value] of params.entries()) {
    // If the key already exists, convert it to an array to store multiple values
    if (result[key]) {
      if (Array.isArray(result[key])) {
        result[key].push(value);
      } else {
        result[key] = [result[key], value];
      }
    } else {
      result[key] = value;
    }
  }

  return result;
}

function objectToQueryString(obj) {
  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(obj)) {
    if (Array.isArray(value)) {
      // If the value is an array, append each value separately
      value.forEach((val) => params.append(key, val));
    } else {
      // Otherwise, add the key-value pair as usual
      params.append(key, decodeURIComponent(value));
    }
  }

  return params.toString();
}

// let listeners: Array<() => void> = [];

// //@ts-expect-error
// AP.events.on("history_popstate", emit);
// //@ts-expect-error
// AP.events.on("history_pushstate", emit);

// const hashStore = {
//   subscribe: (listener: () => void) => {
//     listeners = [...listeners, listener];

//     return () => {
//       listeners = listeners.filter((l) => l !== listener);
//     };
//   },
//   getSnapshot: () => {
//     //@ts-expect-error
//     return AP?.history?.getState() as string;
//   },
//   push: (newValue: string) => {
//     //@ts-expect-error
//     AP?.history?.pushState(newValue);

//     const checkAndEmit = () => {
//       if (hashStore.getSnapshot() === newValue) {
//         emit();
//       } else {
//         setTimeout(checkAndEmit, 10);
//       }
//     };

//     checkAndEmit();
//   },
// };

// function emit() {
//   for (let listener of listeners) {
//     listener();
//   }
// }

// const useConnectedHash = () => {
//   const state = useSyncExternalStore(hashStore.subscribe, hashStore.getSnapshot);

//   return [state, hashStore.push] as const;
// };
