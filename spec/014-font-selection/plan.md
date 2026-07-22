# 014 — Font selection implementation plan

Add a **font picker to the Theme panel** so users can change the font used across all
reports. The chosen font persists like the color theme, applies live, and re-applies on
report load.

## Context

The Theme panel (`src/react/SettingsSidebar/components/Theme/Theme.tsx`) currently only lets
users pick background colors for 8 status categories. Users have asked to also change the
report font.

The infrastructure to do this mostly already exists:

- Fonts are 100% CSS-driven. A `--font-sans` CSS variable is defined in `:root`
  (`src/css/primitives.css:69-73`) and bound to `body`, so an app-wide runtime override is a
  single `document.documentElement.style.setProperty('--font-sans', ...)`.
- The theme system already has the exact persist/apply/startup pattern we need: a storage
  slot behind `AppStorage`, a React-Query hook (`useTheme`), a debounced optimistic save
  (`useSaveTheme`), a CSS-var applier (`applyThemeToCssVars`), and an on-mount re-apply in
  `TimelineReport.tsx`. Charts/Gantt/SVG set **no** font of their own — they inherit the
  cascade, so they follow the override for free.

There are two real obstacles, both handled below:

1. **The Tailwind `.font-sans`/`.font-mono` utilities bypass the variable.** In the compiled
   `dist/production.css`, `.font-sans` emits a *hardcoded* stack (not `var(--font-sans)`) and
   wins over the var-based rule in `fonts.css`. Report tables/cards use `font-sans`
   liberally, so a runtime var override would miss them until Tailwind is pointed at the var
   and CSS is rebuilt once (Change 5).
2. **The theme data model is hardcoded to an array of color items** (`Theme = typeof
   defaultTheme`), and `updateTheme` only persists `{label, backgroundColor}`. Rather than
   refactor that array into an object, we add the font as its own small, parallel setting
   (see decision below).

### Decisions (recommended defaults — easy to change)

- **Separate storage slot, not a refactor of the color model.** Add `getFont`/`updateFont`/
  `applyFontToCssVars` + `useFont`/`useSaveFont` mirroring the theme hooks. This leaves the
  color-array path completely untouched (lowest risk) while the UI still lives in one panel.
- **Curated shortlist, not arbitrary web fonts.** Options are system-safe stacks plus
  **Poppins**, which the app already loads from Google Fonts in every HTML entry point. No
  new `@font-face`/`<link>` loading needed. (Adding a font that isn't already loaded is a
  later enhancement — see Out of scope.)
- **Font controls `--font-sans` only; leave `--font-mono` alone.** Numeric/table columns use
  `font-mono` for alignment and should stay monospace regardless of the sans choice, so we do
  **not** change `mono` in the Tailwind config.

## Changes

### 1. `src/jira/theme/font.ts` (new) — model, storage, applier

Mirror `fetcher.ts` / `utils.ts` for a single font value:

```ts
import { AppStorage } from '../storage/common';

export interface FontOption {
  label: string;
  stack: string; // full CSS font-family stack
}

// System-safe stacks + Poppins (already loaded via Google Fonts in the HTML entry points).
export const FONT_OPTIONS: FontOption[] = [
  {
    label: 'System default',
    stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
  },
  { label: 'Poppins', stack: `'Poppins', ui-sans-serif, system-ui, sans-serif` },
  { label: 'Helvetica / Arial', stack: `'Helvetica Neue', Helvetica, Arial, sans-serif` },
  { label: 'Verdana', stack: `Verdana, Geneva, Tahoma, sans-serif` },
  { label: 'Georgia (serif)', stack: `Georgia, Cambria, 'Times New Roman', Times, serif` },
];

export const defaultFont = FONT_OPTIONS[0].stack;

const fontKey = 'themeFont';

export const getFont = (storage: AppStorage): Promise<string> =>
  storage.get<string>(fontKey, defaultFont);

export const updateFont = (storage: AppStorage, font: string): Promise<void> =>
  storage.update(fontKey, font);

export const applyFontToCssVars = (font?: string) => {
  document.documentElement.style.setProperty('--font-sans', font || defaultFont);
};
```

Export these from the theme barrel (`src/jira/theme/index.ts`) alongside the existing theme
exports so the UI/hooks can import them the same way (`../../../../jira/theme`).

### 2. `src/react/services/theme/key-factory.ts` — add a query key

Add a `font` key next to the existing `themeKeys.theme`, e.g. `font: ['themeFont'] as const`.

### 3. `src/react/services/theme/useFont.ts` (new) — read hook

Mirror `useTheme.ts`:

```ts
import { useSuspenseQuery } from '@tanstack/react-query';
import { getFont } from '../../../jira/theme';
import { useStorage } from '../storage';
import { themeKeys } from './key-factory';

export const useFont = () => {
  const storage = useStorage();
  return useSuspenseQuery({ queryKey: themeKeys.font, queryFn: () => getFont(storage) }).data;
};
```

### 4. `src/react/services/theme/useSaveFont.tsx` (new) — debounced optimistic save

Copy `useSaveTheme.tsx` verbatim, swapping `Theme`→`string`, `updateTheme`→`updateFont`,
`applyThemeToCssVars`→`applyFontToCssVars`, and `themeKeys.theme`→`themeKeys.font`. Keep the
optimistic `onMutate`/rollback and the Atlaskit error flag exactly as-is.

### 5. Close the Tailwind gap — `tailwind.config.js` + one rebuild

Point the `sans` family at the CSS variable so the `.font-sans` utilities and the preflight
`html` rule stop shipping a hardcoded stack:

```js
fontFamily: {
  sans: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif)',
  // serif, mono, bitovipoppins: unchanged  (mono stays hardcoded on purpose)
}
```

Then regenerate the precompiled CSS once: `npm run build:css` (see the
`tailwind-precompiled-css` memory — the app and Storybook load the prebuilt
`dist/production.css`, so this change is invisible until rebuilt). After this one rebuild, a
runtime `setProperty('--font-sans', …)` reaches every `.font-sans` element with no further
rebuilds.

### 6. `src/react/SettingsSidebar/components/Theme/Theme.tsx` — add the font picker

Add a font selector above the color loop, wired to the same debounced live-apply/save shape
the colors already use:

- `const font = useFont();` and `const { save: saveFont } = useSaveFont();`
- Local state + `useDebounce(localFont, 500)` + a `useEffect` that saves when the debounced
  value differs from `font` (identical structure to the existing color effect at lines
  30-36).
- On change: `applyFontToCssVars(newFont)` (live preview) then `setLocalFont(newFont)`.
- Render an Atlaskit `Select` from `@atlaskit/select` (matches the design system; confirm the
  dep exists, else a native `<select>` styled with the existing Tailwind classes) whose
  options are `FONT_OPTIONS.map(o => ({ label: o.label, value: o.stack }))`. Give each option
  an inline `style={{ fontFamily: stack }}` so the dropdown previews each font.
- Extend the existing **Reset theme** button to also reset the font: on reset, call
  `applyFontToCssVars(defaultFont)` and `setLocalFont(defaultFont)` alongside the color reset.

### 7. `src/react/TimelineReport/TimelineReport.tsx` — apply saved font on mount

The existing effect (added in `cbebf8e5`) applies the saved theme on mount. Apply the font
the same way in the same effect:

```ts
useEffect(() => {
  getTheme(storage).then(applyThemeToCssVars).catch(/* existing */);
  getFont(storage).then(applyFontToCssVars).catch((e) =>
    console.error('Something went wrong getting the font', e));
}, [storage]);
```

Import `getFont, applyFontToCssVars` from `../../jira/theme`.

## Risks / caveats

- **Atlaskit components may not inherit the font.** Some `@atlaskit` components set their own
  font-family internally rather than inheriting from `body`. If headings/buttons/lozenges
  don't visibly change during verification, the follow-up is to also set Atlaskit's font
  token (e.g. via `setGlobalTheme`/the `--ds-font-family-*` custom properties) — treat this
  as a fast-follow only if verification shows the gap. Plain report text, tables, and charts
  (the bulk of "all reports") inherit normally and are unaffected.
- **Only already-loaded fonts render as designed.** Non-Poppins Google/web fonts would need a
  `<link>`/`@font-face` — deliberately out of scope; the curated list avoids this.

## Verification

- `npm run build` (typecheck) and the test suite pass.
- **Run `npm run build:css` after the `tailwind.config.js` edit** (Change 5) before any UI
  check — otherwise the `.font-sans` utilities keep their old hardcoded stack and the font
  won't change on table/card text.
- Storybook (credential-free): render the Theme panel, change the font, confirm the preview
  updates. Confirm the dropdown previews each option in its own font.
- End-to-end (needs Jira creds — use the `launch-dev` agent or ask the user): open the Theme
  panel, pick **Poppins**, and confirm report body text, tables (non-`font-mono` cells),
  Gantt/timeline labels, and status legend all switch fonts; confirm `font-mono` numeric
  columns stay monospace. Reload the page and confirm the choice re-applies on mount. Hit
  **Reset theme** and confirm the font returns to System default.

## Out of scope

- Refactoring the color `Theme` array into a unified settings object (kept separate on
  purpose).
- Loading arbitrary/custom web fonts (`@font-face`, dynamic Google Fonts `<link>`).
- Making `font-mono` / numeric columns track the selected font.
- Overriding Atlaskit's internal typography token (only if verification shows it's needed).
