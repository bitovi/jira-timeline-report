# 016/008 — Theme: fonts, section background, and a panel that fits

## Context

The Theme panel (`src/react/SettingsSidebar/components/Theme/Theme.tsx`, 92 lines) does exactly one
thing today: eight background colors for the eight status categories. Two requests have accumulated
against it:

1. **A font that applies everywhere.** Customers want reports to look like their brand, not like
   `-apple-system`.
2. **A section background color for report-of-reports.** Sections are deliberately unframed and
   transparent (see `spec/016-report-of-reports/004-redesign/plan.md` § As built: _"There is no
   surface card… the indent rails are the only structure on the page"_). That reads as flat when a
   document has many sibling sections, and there is no way to visually band them.

Both are theme settings, so both land in the same panel — which is already the problem. Each of the
eight rows is ~90px (Lozenge, description underneath, an `h-11 min-w-20` color input) inside a
**320px-wide** sidebar (`SettingsSidebar.tsx:63-67`, `SidebarLayout className="w-80"`). Adding a font
picker and a ninth color to that makes it worse. So this plan also tightens and groups what's there.

**This plan supersedes `spec/014-font-selection/plan.md`.** That plan covered the preset half of the
font work and was never implemented — there is no `src/jira/theme/font.ts`, no `useFont`, and
`tailwind.config.js:6` still hardcodes the sans stack. Its analysis holds and is folded in below;
mark 014 as superseded rather than leaving two live plans for one feature.

## Why a font file cannot be uploaded

The obvious ask is "let me upload our `.woff2`". We can't, and the reason is worth writing down so
it doesn't get re-litigated.

`AppStorage` (`src/jira/storage/common.ts`) is a flat key → JSON map with two backends, and both cap
near 32 KB:

| Backend                | File                               | Ceiling                                                                                                                                                                                                     |
| ---------------------- | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Connect app properties | `src/jira/storage/index.plugin.ts` | 32 KB per property (Atlassian platform limit; nothing in the repo guards it — an oversized write fails at the API with an opaque error)                                                                     |
| Standalone / hosted    | `src/jira/storage/index.web.ts`    | **All keys share one field.** Every key (`theme`, `features`, reports, `all-team-data`) is serialized into a single JSON `codeBlock` in one Jira issue's description. Jira text fields cap at 32,767 chars. |

A typical WOFF2 is 20–100 KB raw, ~27–135 KB base64 — it fits in neither, and one face is not
enough (regular/bold/italic triples it). The web backend is the sharper edge: `update` re-serializes
the **entire store** and PUTs the whole description back, so a near-limit write risks taking saved
reports and team configs down with it. There is no chunking, no IndexedDB, and no attachment/CDN
upload path anywhere in `src/`. `localStorage` has room but is per-browser, so a theme stored there
would be invisible to everyone else on the team — wrong semantics.

There is also a licensing wrinkle: pushing a commercial font file into a shared Jira property
redistributes it org-wide.

**So we store a font _reference_, never bytes** — a preset stack (~60 chars), or a stylesheet URL
plus a family name (~150 chars) for customers who host their own.

## Changes

### 1. `tailwind.config.js` + one CSS rebuild — the prerequisite

Nothing else in the font work is visible until this lands.

`--font-sans` is declared in `src/css/primitives.css:69-73` and bound to `body`, so a runtime
`setProperty` should restyle the app. It doesn't, because `tailwind.config.js:6` hardcodes the same
stack under `theme.fontFamily.sans`. In the compiled `dist/production.css`:

- line **358** — `.font-sans { font-family: var(--font-sans); }` (from `fonts.css`, imported first)
- line **3872** — `.font-sans { font-family: -apple-system, …; }` (Tailwind utility, later, equal
  specificity → **wins**)
- line **798** — preflight sets the same hardcoded stack on `html`

Report tables and cards use `font-sans` liberally, so the picker would appear to do nothing on most
of the page. Point `sans` at the variable:

```js
fontFamily: {
  sans: 'var(--font-sans, -apple-system, BlinkMacSystemFont, "Segoe UI", "Roboto", "Oxygen", "Ubuntu", "Fira Sans", "Droid Sans", "Helvetica Neue", sans-serif)',
  // serif, mono, bitovipoppins unchanged
}
```

**`mono` stays hardcoded on purpose** — numeric/table columns rely on `font-mono` for column
alignment and must stay monospace regardless of the sans choice.

**The font is scoped to the report, not the whole page.** Overriding `--font-sans` globally also
restyles the app's own chrome — the "Status Reports for Jira" nav in the HTML shell, the settings
sidebar, the saved-reports bar, the report controls. Those are the product's furniture, not the
customer's document. So:

- `:root` gains a second variable, `--report-font-sans`, defaulting to the same stack
  (`primitives.css`). `--font-sans` keeps its global meaning and is never written at runtime.
- `applyFontToCssVars` sets `--report-font-sans` on `documentElement` — the root rather than the
  container, so it stays callable before the report has mounted.
- `fonts.css` gains the scope, applied by `ReportArea` to its report-block wrapper:

  ```css
  .report-font-scope {
    --font-sans: var(--report-font-sans);

    font-family: var(--font-sans);
  }
  ```

Both lines are load-bearing and for different reasons. Redefining `--font-sans` is what reaches
Tailwind's `.font-sans` utility, which resolves the variable at each element — inside the subtree it
picks up the report font, outside it keeps the `:root` value. The `font-family` declaration covers
plain unclassed text: `font-family` inherits as a **computed** value, so without it every
undecorated element would inherit whatever `body` resolved from the root variable and never see the
override.

Then run **`npm run build:css`** once locally. `dist/` is gitignored, so the compiled stylesheet is a
build artifact rather than a committed file — `npm run build` regenerates it (it runs `build:css`
first) and `npm run dev` watches it, so CI and normal dev both pick the change up on their own. The
one stale case is a workflow that reads `dist/production.css` without rebuilding it, which is
exactly what Storybook does (`.storybook/preview.tsx` imports the prebuilt file). After one rebuild,
runtime `--font-sans` overrides reach every `.font-sans` element with no further rebuilds.

### 2. `src/jira/theme/font.ts` (new) — model, storage, applier

Its own storage key, parallel to the color array rather than folded into it. The color path
(`getTheme`'s merge-by-label into `defaultTheme`) is what all eight existing colors depend on;
making its stored value polymorphic to carry a font is risk for no gain.

```ts
export interface FontSetting {
  stack: string; // full CSS font-family value
  url?: string; // https stylesheet to load first, for custom fonts
}

export const FONT_PRESETS: Array<{ label: string; stack: string }> = [
  {
    label: 'System default',
    stack: `-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif`,
  },
  { label: 'Poppins', stack: `'Poppins', ui-sans-serif, system-ui, sans-serif` },
  { label: 'Helvetica / Arial', stack: `'Helvetica Neue', Helvetica, Arial, sans-serif` },
  { label: 'Verdana', stack: `Verdana, Geneva, Tahoma, sans-serif` },
  { label: 'Georgia (serif)', stack: `Georgia, Cambria, 'Times New Roman', Times, serif` },
];

export const defaultFont: FontSetting = { stack: FONT_PRESETS[0].stack };
const fontKey = 'themeFont';
```

Poppins is free — it is already loaded from `fonts.googleapis.com` in all three HTML entry points
(`index.html:37`, `connect.html:34`, `dev.html:20`), though note only weights **500 and 700**, no 400.

`getFont` / `updateFont` mirror `getTheme` / `updateTheme` in `fetcher.ts`. `applyFontToCssVars`
mirrors `applyThemeToCssVars` in `utils.ts`, plus link management:

```ts
const FONT_LINK_ID = 'theme-font-stylesheet';

export const applyFontToCssVars = (font?: FontSetting) => {
  const { stack, url } = font ?? defaultFont;
  const existing = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;

  if (url && isAllowedFontUrl(url)) {
    const link = existing ?? Object.assign(document.createElement('link'), { id: FONT_LINK_ID, rel: 'stylesheet' });
    if (link.href !== url) link.href = url; // guard: reassigning href refetches
    if (!existing) document.head.appendChild(link);
  } else {
    existing?.remove();
  }

  document.documentElement.style.setProperty('--font-sans', stack || defaultFont.stack);
};
```

Two validators in the same file, both exported so they can be unit-tested and reused by the UI:

- **`isAllowedFontUrl(url)`** — `new URL()` in a try/catch, require `protocol === 'https:'`. Rejects
  `javascript:`, `data:`, and plaintext `http:`.
- **`sanitizeFontFamily(name)`** — the family name is interpolated into a CSS value, so strip
  everything outside `[A-Za-z0-9 -]` and wrap the result in single quotes before composing
  `'Inter', sans-serif`. Without this, `'; background: url(…)` breaks out of the declaration.

Export all of it from the `src/jira/theme/index.ts` barrel next to the existing theme exports.

Drive-by while in `primitives.css`: line 8 reads `--ontrack-text-color: '#fff';` — quoted, therefore
an invalid color until `applyThemeToCssVars` overwrites it. Unquote it.

### 3. React service layer — `useFont` / `useSaveFont`

- `src/react/services/theme/key-factory.ts` — add `font: ['themeFont'] as const` beside
  `theme: ['theme']`.
- `src/react/services/theme/useFont.ts` (new) — `useSuspenseQuery`, copied from `useTheme.ts`.
- `src/react/services/theme/useSaveFont.tsx` (new) — copy `useSaveTheme.tsx` verbatim, swapping
  `Theme`→`FontSetting`, `updateTheme`→`updateFont`, `applyThemeToCssVars`→`applyFontToCssVars`,
  `themeKeys.theme`→`themeKeys.font`. **Keep the optimistic `onMutate`/rollback and the Atlaskit
  error flag exactly as-is** — including the `onError` that restores the DOM, which is what makes a
  failed save visually revert.

Note `src/react/services/theme/index.ts` only re-exports `useTheme`; `Theme.tsx` deep-imports
`useSaveTheme`. Follow whichever convention, but adding all four to the barrel is the tidier move.

### 4. `src/jira/theme/fetcher.ts` — a ninth entry and a `group` field

Section background reuses the color machinery wholesale. The fetcher merges saved values into
`defaultTheme` **by label** and persists only `{label, backgroundColor}`, so appending an entry is
backward compatible for free: an existing saved theme simply has no `Section` label and falls
through to the default. `applyThemeToCssVars`, the APCA text-color derivation, and **Reset theme**
all then work with zero changes.

```ts
{
  label: 'Section',
  description: 'Background behind each section in a report of reports',
  backgroundColor: '#FFFFFF',
  backgroundCssVar: '--section-color',
  textCssVar: '--section-text-color',
  group: 'reportOfReports',
}
```

`#FFFFFF` renders identically to today's transparent against the white page, so **nothing changes
for existing users** until they pick a color.

**The `group` field is not cosmetic — it fixes a bug this entry would otherwise cause.**
`StatusKey.tsx` (the legend in the report footer) maps over the _entire_ theme array and renders a
Lozenge per entry, with no filter. Without a discriminator, a "Section" chip leaks into the legend of
every report. So:

- Add `export type ThemeGroup = 'status' | 'reportOfReports'` and tag all eight existing entries
  `group: 'status'`.
- Replace `export type Theme = typeof defaultTheme` with an explicit
  `export interface ThemeItem { label; description; backgroundColor; backgroundCssVar; textCssVar; group: ThemeGroup }`
  and `export type Theme = ThemeItem[]`. The inferred type would widen `group` to `string` and make
  it useless for narrowing.
- `StatusKey.tsx` — filter to `group === 'status'` before mapping.

`group` is derived from `defaultTheme` on every read and never persisted (`updateTheme` still saves
only `{label, backgroundColor}`), so there is no migration.

Also add the two new vars to the `:root` block in `src/css/primitives.css` (`--section-color: #ffffff`,
`--section-text-color: #000000`) — that block already duplicates every default and is kept in sync by
hand.

### 5. Consume the section color in report-of-reports

`ReportOfReports/` has **zero inline styles and zero `var(--…)` today** — it is pure Tailwind. Rather
than break that (and rather than a dynamic `bg-${color}` class, which Tailwind's static scanner will
not emit), add a rule next to the existing `.color-bg-*` family in `src/css/colors.css`:

```css
.color-bg-section {
  background-color: var(--section-color);
}
.color-text-section {
  color: var(--section-text-color);
}
```

- **`SectionView`** (`src/react/reports/ReportOfReports/ReportOfReports.tsx:174-233`) — add
  `color-bg-section` to the `<section>` className. The conditional `bg-blue-101` add-target tint
  still wins, because `colors.css` is imported before `@tailwind utilities` and the utility therefore
  lands later at equal specificity. Drag-target highlighting is unaffected.
- **`SectionTitle`** (`ReportOfReports/components/SectionTitle.tsx`) — add `color-text-section` so the
  title stays legible on a dark background. For the untitled placeholder, replace the fixed
  `text-slate-500` with `color-text-section opacity-60`; a fixed slate reads as muted on white but
  becomes unreadable on a dark section.

Deliberately **not** putting `color:` on the `<section>` itself: it would cascade into embedded report
tables and cards, which set backgrounds but not text colors, and break them on any dark section.

Two consequences to accept and document:

- **Nested sections flatten.** Every `<section>` reads the same var, and descendants
  (`IndentLevel`, `NodeRow` at rest) are transparent, so a nested section paints the identical color
  over its parent. Depth reads from the indent rails, not from color. A per-section override belongs
  on `SectionNode.params` (`ReportOfReports/model/sections.ts:11-16` already anticipates section
  params, and `WithRaw`/`storedParams` preserve unknown keys) — explicitly out of scope here.
- **`NodeRow`'s hover tint survives.** `bg-neutral-201` is `#091E420F`, 6% black — alpha, so it
  composites over any background. The pinned state's `bg-blue-101` is opaque and will override the
  section color on that one row; acceptable for a transient editing affordance.

Printing works already: `src/css/print.css:43-48` forces `print-color-adjust: exact !important` on
`*`, so section backgrounds print.

### 6. `Theme.tsx` — restructure the panel

Target layout in the 320px sidebar:

```
Theme                            [spinner]
Font  [ System default        ▾ ]

▾ Status colors
   ●Complete                    [■]
    End date in the past
   ●Blocked                     [■]
    Has Jira status or label of "blocked"
   … 6 more

▾ Report of Reports
   ●Section                     [■]
    Background behind each section

[         Reset theme           ]
```

**Grouping.** Reuse `src/react/components/Accordion/` (`Accordion`, `AccordionTitle`,
`AccordionContent` — compound components over a context; `AccordionContent` unmounts when closed).
Both groups get `startsOpen`; once rows are tightened the panel fits without much scrolling, and
collapsing the colors would hide the feature from users who already know where it is. Existing call
sites to copy: `ConfigureAllTeams.tsx:31`, `LoadChildren.tsx:8`.

**Tightened rows.** Keep the description, shrink the row from ~90px to ~55px: drop the outer
`gap-8` to `gap-3`, keep the `text-xs text-slate-700` description under the Lozenge, and shrink the
color input from `h-11 min-w-20` to roughly `h-8 w-14`.

**Key updates by label, not index.** The current handler closes over the map index
(`Theme.tsx:65-77`); once the array is filtered into two groups those indices no longer line up.
Replace with a single helper — labels are already the persistence key, so they are unique:

```ts
const updateColor = (label: string, backgroundColor: string) =>
  updateLocalTheme(localTheme.map((item) => (item.label === label ? { ...item, backgroundColor } : item)));
```

Then `localTheme.filter((t) => t.group === 'status')` and `=== 'reportOfReports'` drive the two
groups. Extract the row into `Theme/components/ColorRow/ColorRow.tsx` since it is now rendered from
two places.

**Font picker** — `Theme/components/FontPicker/FontPicker.tsx`, an `@atlaskit/select` whose options
are `FONT_PRESETS` plus a `Custom…` entry, each option carrying `style={{ fontFamily: stack }}` so
the dropdown previews itself. `Select.tsx` under `TeamConfiguration/…/components/Select/` is the
existing wrapper pattern if grouping is wanted. Choosing `Custom…` reveals two
`@atlaskit/textfield`s (stylesheet URL, family name) and a preview line.

Live-apply and persistence follow the existing color shape exactly: local state →
`applyFontToCssVars` immediately for preview → `useDebounce(localFont, 500)` → an effect that saves
when the debounced value differs from the server value. **Only inject the `<link>` once the URL
passes `isAllowedFontUrl`**, so a half-typed URL doesn't fire a request on every 500ms pause; show
an `@atlaskit/form` `ErrorMessage` for a rejected URL.

**Reset theme** resets both: `updateLocalTheme(defaultTheme)` and `updateLocalFont(defaultFont)`.

**`ThemeWrapper.tsx`** — the Suspense skeleton is hardcoded to nine `<Skeleton height="44px" />` rows
(for eight entries). Retune to the new compact layout.

### 7. `TimelineReport.tsx` — apply the saved font on mount

The existing effect at `src/react/TimelineReport/TimelineReport.tsx:114-119` applies the saved theme
on mount. Apply the font in the same effect, with its own catch:

```ts
getFont(storage)
  .then(applyFontToCssVars)
  .catch((e) => console.error('Something went wrong getting the font', e));
```

## Risks

- **Arbitrary stylesheet URL = arbitrary CSS.** A custom font URL loads a stylesheet the org's admin
  chooses into every user's app. CSS alone can exfiltrate via attribute selectors plus
  `background-image` requests. The https-only check stops protocol tricks but not a hostile
  stylesheet from a host the admin trusted. Judgment: the person editing Theme is already an
  admin-level user of their own instance, configuring it for their own org, so this is a small
  escalation over what they can do anyway. **If that isn't acceptable, the hardened variant is to
  accept a direct `.woff2`/`.woff` URL and build the `@font-face` ourselves** — no third-party CSS
  enters the page, at the cost of one weight per URL and losing the paste-a-Google-Fonts-URL flow.
  Flag this for a call during implementation.
- **Atlaskit may not inherit the font.** Some `@atlaskit` components set `font-family` internally
  rather than inheriting from `body`, and no `--ds-font-*` override exists in the repo today. Plain
  report text, tables, and charts inherit normally (charts/Gantt/SVG set no font of their own).
  Verify first; if headings/buttons/lozenges inside the report don't change, the fast-follow is to
  set Atlaskit's font tokens **on `.report-font-scope`**, not globally — a `setGlobalTheme` call
  would restyle the chrome the scope exists to protect.
- **Anything portaled out of the report block escapes the scope.** Atlaskit renders modals,
  dropdowns, and tooltips into a portal at `body` level, so they keep the chrome font even when
  triggered from inside a report. That is the right default — they are chrome — but it means a
  report's own popup content will not match its body text.
- **`@atlaskit/renderer` needs a CSS override, not just a token.** The latest-update node's comment
  body is drawn by `ReactRenderer`, which sets an explicit `font-family` — so inheritance never
  reaches it. Setting `--ds-font-family-body` on the scope fixes the renderer root, but **not** the
  prose: block content is styled from `editor-common`'s UGC tokens, which
  `ugc-tokens/get-editor-ugc-token.js` returns as plain strings with the family baked into a `font`
  shorthand (`'normal 600 1.71429em/1.16667 "Atlassian Sans", …'`). There is no `var()` to redefine,
  so `fonts.css` also carries a `font-family` longhand on `.ak-renderer-document` and its `p`/`h1`–`h6`.
  Two traps worth remembering: the shorthand also sets size/weight/line-height, so only the longhand
  may be overridden; and the override must **not** be a blanket descendant selector, because
  Atlaskit puts code's monospace on a wrapping `span.code` rather than the `<code>` element — hitting
  every descendant turns inline code into body text.
- **Hardcoded font families inside the report defeat the setting.** A top-level section title was
  pinned to `font-bitovipoppins` (`SectionTitle.headingFor`, from commit `06d13bc1`), so it ignored
  the chosen font while the rest of the document followed it. Fixed here by dropping the family and
  keeping size/weight. Any future `font-*` family class inside the report block has the same
  problem — the report is the customer's document and should use their font throughout. Poppins
  branding stays on chrome (`LoginButton`, the shell nav), which is outside the scope.
- **A slow or dead custom font URL** degrades to the fallback in the stack — acceptable, since every
  composed stack ends in a generic family.
- **A stale `dist/production.css` makes the whole font feature look broken** while every unit test
  passes. `npm run build` and `npm run dev` both regenerate it, so this only bites tools that read
  the prebuilt file directly — Storybook above all.

## Verification

1. `npm run typecheck` and `npm test` pass.
2. **`npm run build:css` after the `tailwind.config.js` edit**, before any visual check.
3. New unit tests:
   - `isAllowedFontUrl` rejects `http:`, `javascript:`, `data:`, and malformed input; accepts `https:`.
   - `sanitizeFontFamily` strips quotes, semicolons, and braces.
   - `applyFontToCssVars` sets `--font-sans`, adds the `<link>` for a custom font, and **removes** it
     when switching back to a preset.
   - `getTheme` returns the `Section` entry when the stored theme predates it (merge-by-label
     backward compatibility).
   - `StatusKey` renders eight lozenges, not nine — i.e. no `Section` chip in the legend.
   - Extend `Theme.test.tsx` beyond its current smoke test: both accordion headings render, and a
     color change routes by label rather than index.
4. Storybook (`npm run storybook`, credential-free): render the Theme panel, confirm the two groups,
   the tightened rows, per-option font previews in the dropdown, and the custom-URL error state.
5. End-to-end (needs Jira credentials — use the `launch-dev` agent or ask):
   - Pick **Poppins**; confirm body text, non-`font-mono` table cells, Gantt/timeline labels, and the
     status legend all change, and that `font-mono` numeric columns stay monospace.
   - Pick **Custom…**, paste a Google Fonts `css2` URL and its family; confirm it loads and applies.
   - Open a report-of-reports with nested sections, set a mid-tone Section color; confirm the
     background paints, titles stay legible, the add-report hover tint still shows, and print preview
     retains the color.
   - Reload — confirm both font and colors re-apply on mount.
   - **Reset theme** — confirm colors and font both return to default and the custom `<link>` is
     removed.
6. Mark `spec/014-font-selection/plan.md` superseded by this plan.
