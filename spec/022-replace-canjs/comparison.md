# Comparison and recommendation

## The matrix

|                                             | A — signals adapter               | B — in-house core       | C — React-idiomatic                              |
| ------------------------------------------- | --------------------------------- | ----------------------- | ------------------------------------------------ |
| Consumer files changed                      | **~12**                           | ~12                     | **~100**                                         |
| Report signatures change                    | no                                | no                      | **yes, all of them**                             |
| New runtime dependency                      | `@preact/signals-core` (~2 KB gz) | none                    | none                                             |
| Lines we maintain                           | ~350                              | ~600                    | ~0 framework, but every hook is ours             |
| Can land incrementally                      | **yes** — prop by prop            | yes                     | **no** — needs both systems live, or one big cut |
| Revertible mid-flight                       | yes                               | yes                     | not really                                       |
| Reproduces CanJS scheduling                 | approximately                     | **exactly, if we want** | n/a — different model                            |
| Fixes the `useCanObservable` subscribe race | no (keeps the workaround)         | no                      | **yes** (`useSyncExternalStore`)                 |
| Fixes coarse re-renders on URL change       | no                                | no                      | **yes**                                          |
| Deletes `ChildReportConfig.js` duplication  | partially (shared registry)       | partially               | **fully** (one context, two sources)             |
| Reports testable with plain props           | no                                | no                      | **yes**                                          |
| Biggest unknown                             | write-during-read may throw (§A6) | we own correctness      | loading-progress redesign (§C4)                  |

## Do these regardless of which option wins

Three things are improvements on their own merits and are prerequisites for all three options. They
could even be done first, as a separate PR, before the engine question is settled.

1. **Collapse the two param schemas into one registry.** `route-data.js`'s prop descriptors and
   `ChildReportConfig.js`'s `CHILD_PARAMS` table describe the same ~60 params, kept aligned by a
   drift test. One `PARAMS` table ([`routing.md`](./routing.md) §6) gives real types, deletes the
   drift test, and makes "add a param" a one-line change instead of two.
2. **Extract the URL layer** into [`url-store.ts`](./routing.md) §2. It has no reactive-core
   dependency and is testable in jsdom in a way `RoutePushstate` never was.
3. **Delete the dead weight** found while surveying: `domEvents.addEvent(domMutateDomEvents.inserted)`
   (`main-helper.js:25` — no StacheElements remain), the no-op
   `routeData.on('timingCalculations', () => {})` (`main-helper.js:117`), ~230 lines of commented-out
   alternates in `state-storage.js`, and `compareTo`'s unreachable `stringify` branch that references
   an undeclared `date` (`route-data.js:263`).

## Bundle impact — measure, don't assume

`src/can.js` is 1,473,377 bytes of vendored source. It is an ES module, so Vite _could_ tree-shake
it, but the shipped minified `main-helper` chunk still contains string markers for `can-stache`
(×10), `can-connect` (×9), `can-query-logic` (×5) and `can.viewInsert` (×3) — subsystems this app
never touches. So a meaningful chunk of it ships today.

**The exact saving should be measured with a before/after `npm run build`, not estimated.** It is a
nice side effect, not the reason to do this work — the reason is that ~500 lines of behaviour are
currently expressed through an undebuggable, untyped, unmaintained dependency.

## Alternatives that don't get their own option

**MobX.** The closest semantic match by far — `RouteData` is literally a class of observable props
and computed getters, which is `makeAutoObservable`'s home ground, and `mobx-react-lite`'s `observer`
would replace `useCanObservable`. Rejected as a _primary_ option because it is ~16 KB gz, introduces
a second paradigm alongside React Query, and requires `observer()` on ~100 components — so it has
Option C's churn with Option A's "we still have a reactive framework" downside. Worth reconsidering
only if the `resolverCell` spike (A §6) fails _and_ nobody wants to own Option B's core.

**Zustand / Valtio.** Both are excellent stores and neither solves this problem. The hard part is not
"hold state and notify" — it is the ~25 _lazily derived, glitch-free, async-resolving_ properties.
Zustand's derived state is selector functions recomputed per subscriber (no shared memoization, no
laziness); Valtio's proxy model doesn't express `value({resolve, listenTo, lastSet})` at all. Either
would be a fine home for `Login`, which is four booleans — not for `RouteData`.

**TanStack Router / React Router.** Their value is path matching, nested layouts, loaders and
type-safe search-param validation. This app has **zero routes**, and it runs inside a Jira Connect
iframe where the real URL is owned by `AP.history` — every router assumes it owns `history`.
TanStack Router's `validateSearch` is genuinely attractive for the ~60 typed params, but adopting a
router to get a codec table, then fighting it over `history` ownership, is a bad trade against the
~130-line store in [`routing.md`](./routing.md). Revisit if path-based routing is ever wanted.

**`nuqs` and similar URL-state hooks.** Right idea, wrong constraints: they assume they own
`history`/the router adapter, and none of them model the URL → saved-report → default precedence
that is this app's actual behaviour.

## Recommendation

**Option A, sequenced so that Option C is where it ends up.**

1. Do the three "regardless" items above first, as their own PR. They stand alone and shrink every
   option that follows.
2. **Spike `resolverCell` against the five hardest props** — `selectedIssueType`, `toIssueType`,
   `timingCalculations`, `fieldsToRequest`, `allFieldsToRequest` — before committing. This is the
   one thing that decides A vs B, and it is maybe a day's work.
3. Take A. CanJS leaves in a diff of ~12 files that a reviewer can actually hold in their head, with
   ~100 consumer files provably unaffected because they didn't change.
4. If the spike fails, take B. The `value.ts` / `define-props.ts` boundary means that swap is a
   ~20-line import change, not a redesign.
5. Then migrate toward C incrementally, one file at a time, with no deadline — A §7 step 6.

**The reasoning:** the value here is removing a 1.47 MB unmaintained dependency and making the state
layer legible. Option C delivers more, but bundles that win together with ~100 files of churn and a
loading-progress redesign into one un-revertable change. A gets CanJS out at a fraction of the risk
and _does not_ foreclose C — it makes C reachable in small pieces instead of one leap.

**Against the recommendation, honestly:** if the adapter is going to sit there for two years because
nobody ever gets to step 5, then A has traded a well-known dependency for a bespoke one, and C's
one-time cost would have been cheaper. That is a judgement about team capacity, not about the code.
If the answer is "we will never do step 5", pick C.

## Open questions

1. **A, B, or C** — and if A/B, does the ~100-file consumer migration get scheduled or stay open-ended?
2. **The Connect mirroring change** ([`routing.md`](./routing.md) §4): today `replaceState`
   navigations are not mirrored into `AP.history`, so the container URL goes stale during a
   `compareTo` drag. Fix it as part of this, or preserve the asymmetry?
3. **Loading progress** (§C4): keep the current external-store-of-ticks shape under every option, or
   redesign it only if C is chosen?
4. **Forge.** `spec/021-forge` exists — does the Forge host have its own `history` constraints that
   should shape [`url-store.ts`](./routing.md) now rather than later?
