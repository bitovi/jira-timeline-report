# autocomplete → React rewrite plan

**Source:** `src/canjs/ui/autocomplete/autocomplete.js` (~103 lines) + `autocomplete.html` (demo)
**Custom elements:** `<auto-complete>` (public), `<auto-complete-suggestions>` (internal helper)
**Status: DEAD CODE — plan is DELETE, not port.**
**Difficulty: Easy**

## Is it used?

No live usage. `<auto-complete>` is rendered in exactly one place — inside `<status-filter>` (`status-filter.js:6-9`) — and `<status-filter>` is itself never rendered anywhere (see `../status-filter/plan.md`). So the whole autocomplete → status-filter subtree is registered at load but never instantiated in the running app.

`autocomplete.html` is a standalone demo page (hardcoded movie list), not part of the app.

## What it does (for reference)

A multi-select tag/chip input. Props: `data` (all options), `selected` (chosen), `showingSuggestions`. Renders chips with remove buttons + a text input; on focus/input it filters `data` and renders matches into a `SimpleTooltip` popover positioned below the input, with outside-click-to-close. Emits no events — communicates by mutating its two-way-bound `selected` prop. Does **not** touch routeData. No keyboard navigation.

## CanJS surface

`StacheElement`, `type.Any`; imports `ObservableObject` + `fromAttribute` but they are unused. Stache `{{#if}}` / `{{#for}}` / `on:click|focus|input`, `.initialize()`, `.listenTo()`, `connected`/`disconnected` lifecycle. Depends on `SimpleTooltip` (`../simple-tooltip/simple-tooltip.js`, a plain HTMLElement — not CanJS).

## Replacement

The status-filter use case is already served in React by `src/react/reports/FlowMetrics/ChecklistDropdown.tsx` (button-triggered dropdown, outside-click-close, Select-All). No behavior needs re-creating for parity.

## Steps

1. Delete `src/canjs/ui/autocomplete/` (the `.js` and the demo `.html`) together with `status-filter.js`.
2. Ensure the `timeline-report.js:5` status-filter import removal (from the status-filter plan) also drops this transitively — `auto-complete` has no other importer.
3. Leave `src/canjs/ui/simple-tooltip/` alone — it is still used by `select-cloud` and `table-grid`.

## Risks / open questions

- None material. Confirm no other importer of `autocomplete.js` before deleting (expected: only `status-filter.js`).
- If a true typeahead is needed later, build on `@atlaskit/select` — do not resurrect this.
