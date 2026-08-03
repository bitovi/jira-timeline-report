/**
 * The CanJS surface this app still uses.
 *
 * This file used to be a 1.4 MB prebuilt "CanJS 6 core" bundle checked into the repo. That bundle
 * carried 68 `can-*` modules — can-stache, can-stache-element, can-stache-bindings, the whole
 * can-view-* layer, can-connect, can-query-logic, can-fixture, can-rest-model, can-memory-store —
 * none of which this app imports. Tree-shaking could not reach them: the bundle was one flat
 * script full of top-level side effects (symbol registration, can-namespace assignment, prototype
 * patching), so Rollup had to assume every statement mattered. Importing only the ten names below
 * shipped essentially the same bytes as importing all 68 modules.
 *
 * Depending on the individual packages instead cut production JS by 224 KB raw / 65 KB gzip
 * (measured A/B on `npm run build:js` at the same commit). Every version in package.json matches
 * the one baked into the old bundle, except can-observable-object, whose version the bundle did
 * not stamp. npm dedupes all of them to a single copy, which CanJS requires — can-symbol,
 * can-namespace and can-queues must be singletons or observation breaks across packages.
 *
 * Keep this list minimal — it is the whitelist of what CanJS still costs us, and adding a name
 * here can pull a whole subtree back in. The CanJS -> React migration (spec/011) is retiring the
 * last consumers; once `canjs/routing/route-data.js` and the `useCanObservable` bridge are gone,
 * this file and its ten dependencies go with them.
 */
export { default as ObservableObject } from 'can-observable-object';
export { default as value } from 'can-value';
export { default as Reflect } from 'can-reflect';
export { default as route } from 'can-route';
export { default as RoutePushstate } from 'can-route-pushstate';
export { default as diff } from 'can-diff';
export { default as type } from 'can-type';
export { default as queues } from 'can-queues';
export { default as domEvents } from 'can-dom-events';
export { default as domMutateDomEvents } from 'can-dom-mutate/dom-events.js';
