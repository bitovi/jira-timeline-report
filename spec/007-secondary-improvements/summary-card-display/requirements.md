# Idea 2 — Summary card display (shared render surface)

## Problem

Today each secondary-report card shows the per-child **status swatches** (`status` mode: one
swatch per child; `breakdown` mode: the four-work-type matrix). That answers "what color is each
child" but not "what is going on with this initiative". We want each card to be able to show a
short **narrative summary** in place of (or above) the swatch rows.

This idea defines the **rendering surface** only — the card layout that displays a summary. The
_source_ of the summary text is a separate decision (ideas 3–7). Building this once means every
source plugs into the same UI.

## User value

- The card reads like a status update, not a heat map.
- One consistent place for narrative regardless of where the text comes from.
- Degrades gracefully: no summary → fall back to today's swatch view.

## How it might work

### A "summary" secondary-report mode / display option

Two possible framings (pick during design):

- **New display mode** — add `summary` alongside `status` / `breakdown` in
  `secondaryReportType`. Selecting it swaps the card body for the narrative layout.
- **Overlay toggle** — a "Show summaries" toggle orthogonal to the mode, which replaces or
  prepends the summary above the existing body.

Recommended: start as a **display option** on the card body so it composes with the Idea 1
filter (e.g. "Needs attention" + "summaries" is the primary status-meeting view).

### Card layout

Extend the `Card` view model in
[`types.ts`](../../../src/react/reports/WorkBreakdown/types.ts) with an optional:

```ts
summary?: {
  text: string;            // plain text / limited markdown
  source: 'field' | 'comment' | 'ai' | 'user';
  author?: string;         // display name when known
  updated?: Date;          // when the summary was written/generated
  truncatedFrom?: number;  // original length, if clamped
};
```

`buildBoard` populates `summary` from whatever source adapter is active (ideas 3–7 each provide a
`getSummary(issue)` implementation). The card component:

- Renders the summary block where the swatch rows are today (child status hidden when a summary
  exists, per the requirement "remove the status for the child work-items ... instead have some
  sort of summary").
- Shows a small provenance line: source icon + author + relative time ("Field · JM · 2d ago").
- Clamps to ~3–4 lines with a "more" affordance; full text in the existing
  [`IssuePopup`](../../../src/react/reports/WorkBreakdown/components/IssuePopup/IssuePopup.tsx).
- **Fallback:** when `summary` is absent, render today's `StatusColumnBody` / `StatusMatrixBody`
  unchanged.

### Density

The board already computes a `density` tier from card count. Summaries are taller than swatch
rows, so the summary display should clamp line-count more aggressively at higher densities (reuse
`fontSizeClass` / density plumbing already in `buildBoard`).

## Acceptance criteria

- [ ] `Card` view model carries an optional `summary` with text + provenance metadata.
- [ ] When a card has a summary, the card renders the narrative block instead of the per-child
      status rows; provenance (source/author/updated) is shown.
- [ ] When a card has no summary, the card renders exactly as today (no regression).
- [ ] Long summaries clamp with a "more" affordance; full text available in the popup.
- [ ] The summary display composes with the Idea 1 filter (summaries + "needs attention").
- [ ] New rendering is covered by component tests + a Storybook story (matches the existing
      `WorkBreakdownCard.stories.tsx` pattern).

## Open questions

- New `summary` **mode** vs. orthogonal **toggle**? (Leaning toggle so it stacks with the
  filter.)
- Do we ever show summary **and** swatches together (e.g. summary on the card, swatches in the
  popup)? Proposed: summary replaces swatches on the card; swatches remain in the popup.
- Markdown support level — plain text, or a safe subset (bold/links)? Jira text is ADF; see the
  source-specific docs for conversion. Start plain-text.

## Effort & risk

- **Effort:** Small–Medium (pure view-model + one card layout + stories/tests).
- **Risk:** Low. Additive and behind a toggle; fallback preserves current behavior.
- **Blocks:** ideas 3–7 all render through this surface — build first (or in parallel with a
  stub `getSummary`).
