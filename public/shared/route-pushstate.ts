import { deparam, ObservableObject, param, route, RoutePushstate } from "../can.js";

export const underlyingReplaceState = history.replaceState;

export const pushStateObservable = new RoutePushstate();

route.urlData = pushStateObservable;
route.urlData.root = window.location.pathname;
// @ts-expect-error
route.register('/');
// @ts-expect-error
route.start();

const keyObservable = new (ObservableObject as ObjectConstructor)();

// // @ts-expect-error
// keyObservable[Symbol.for('can.onPatches')](
//   function() {
//     // @ts-expect-error
//     this.get();

//     // @ts-expect-error
//     pushStateObservable.value = `?${param(this.get())}`;
//   }
// );
// // @ts-expect-error
// route.on('url', () => {
//   // @ts-expect-error
//   keyObservable.set(deparam(pushStateObservable.value));
// });

const proxiedRouteData = new Proxy(
  route.data,
  {
    get(target, p) {
      if (p === 'set') {
        return function(...args: [string, any] | [any]) {
          const value = args.pop();
          const key = args[0];

          if (!key && value && typeof value === 'object') {
            const newValue = Object.entries(value).reduce((a, [key, val]) => ({ ...a, [key]: val ?? undefined }), {});
            target.set.call(newValue);
          } else if (key) {
            target.set.call(target, key, value ?? undefined);
          }
        };
      } else {
        return target[p];
      }
  },
});

export default proxiedRouteData;