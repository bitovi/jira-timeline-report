export function beforeCanRouteIsCalled() {
  debugger;
  const search = new URLSearchParams(
    decodeURIComponent(AP?.history.getState("all").query?.state ?? "")
  );

  history.replaceState(null, "", "?" + search.toString());
}

export function initialize() {
  if (!window.AP) {
    console.log("Not in plugin mode");
    return;
  }

  const originalPushState = history.pushState;

  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    console.log("push state", { args: [...args], location: window.location });

    AP?.history.replaceState({
      query: { state: new URLSearchParams(window.location.search).toString() },
      state: { fromPopState: "false" },
    });
  };

  addEventListener("popstate", function (...args) {
    console.log("popstate", args);
  });

  setInterval(function () {
    document.querySelector("nav").innerHTML = window.location.search.toString();
  }, 200);
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
