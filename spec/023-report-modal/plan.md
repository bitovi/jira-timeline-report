# Add Report modal redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the report-of-reports "Add Report" picker into a searchable, left-aligned list where every row shows a per-type icon and badge, without changing what a saved report stores.

**Architecture:** A shared, pure `reportTypeMeta(typeKey)` map (key → display name + color) and a `<ReportTypeIcon>` component become the single source of truth for how a report type looks. `AddReportModal` derives a `{ report, typeKey, typeName, jql }` view-model from the `Report[]` it already receives, renders it as rows, and adds client-side search over name + type. No storage, no fetch, and the `onSelect`/`onClose` prop contract is unchanged.

**Tech Stack:** React 18, TypeScript (strict), `@atlaskit/modal-dialog` + `@atlaskit/textfield`, Tailwind, Vitest + Testing Library.

## Global Constraints

- **No change to the stored `Report` schema.** The record stays `{ id, name, queryParams, sections? }` ([src/jira/reports/fetcher.ts](../../src/jira/reports/fetcher.ts)). "When / by whom" metadata is an explicit non-goal here (see [README.md](./README.md) § "What we don't have").
- **All new UI is React + Atlaskit + Tailwind.** No CanJS components (repo migration rule).
- **Search is client-side only.** Every saved report is already in memory before the modal mounts — no query.
- **One shared type→icon map.** The modal, the Saved Reports page, and the report-type dropdown must all read the same `reportTypeMeta` / `<ReportTypeIcon>` so a type looks identical everywhere. Do not inline SVGs per call site.
- **Tolerate unknown types.** An unrecognized `primaryReportType` (older/newer data) must render a neutral fallback icon + the raw key as the name, never throw.
- **Prettier:** single quotes, 120 print width, 2-space indent.
- **The button's accessible name stays the report name.** Rows gain badge + meta text; the clickable element must still expose just `report.name` as its accessible name so existing `getByRole('button', { name })` semantics hold.

---

## File structure

| File                                                                            | Responsibility                                                                                                                     |
| ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/react/reports/ReportOfReports/model/report-type-meta.ts` (new)             | Pure: `primaryReportType` key → `{ key, name, tone }`; unknown → neutral fallback. Names come from `src/configuration/reports.ts`. |
| `src/react/reports/ReportOfReports/model/describe-report.ts` (new)              | Pure: `Report` → `{ report, typeKey, typeName, jql }` by parsing `queryParams`.                                                    |
| `src/react/components/ReportTypeIcon/ReportTypeIcon.tsx` (new)                  | Shared presentational component: given a `typeKey`, renders the tinted SVG tile. One `<svg>` per type + a fallback.                |
| `src/react/components/ReportTypeIcon/index.ts` (new)                            | Barrel export.                                                                                                                     |
| `src/react/reports/ReportOfReports/components/AddReportModal.tsx` (modify)      | Search field + row list built from the view-model; empty vs. no-results states.                                                    |
| `src/react/reports/ReportOfReports/components/AddReportModal.test.tsx` (modify) | Update for the new DOM; add search / no-results / type-badge tests.                                                                |

Reference (do not change) the mockup for the exact visuals: [mockups/add-report-modal.html](./mockups/add-report-modal.html).

> **Where these landed.** A follow-up pulled `report-type-meta.ts` and `describe-report.ts` out of
> `ReportOfReports/model/` into [`src/react/components/ReportListing/`](../../src/react/components/ReportListing/)
> — neither is report-of-reports-specific, and `<ReportTypeIcon>` was importing its tone type back
> _out of_ the report folder. The row markup and the search that Tasks 2–3 below build inline in
> `AddReportModal` now live there too, as `<ReportRow>` / `useReportSearch()`, shared with the Saved
> Reports page. Paths in the tasks below are the originals; read them as `components/ReportListing/`.

---

## Task 1: `reportTypeMeta` — the shared type → name + tone map

**Files:**

- Create: `src/react/reports/ReportOfReports/model/report-type-meta.ts`
- Test: `src/react/reports/ReportOfReports/model/report-type-meta.test.ts`

**Interfaces:**

- Consumes: the `reports` array from [src/configuration/reports.ts](../../src/configuration/reports.ts) (each entry has `key`, `name`).
- Produces:

  ```ts
  export type ReportTypeTone =
    | 'gantt'
    | 'scatter'
    | 'estprogress'
    | 'scheduler'
    | 'estanalysis'
    | 'table'
    | 'flow'
    | 'tis'
    | 'cards'
    | 'ror'
    | 'neutral';
  export interface ReportTypeMeta {
    key: string;
    name: string;
    tone: ReportTypeTone;
  }
  export const reportTypeMeta: (typeKey: string | undefined | null) => ReportTypeMeta;
  ```

  Tone-per-key mapping (values from the mockup):
  `start-due→gantt`, `due→scatter`, `estimation-progress→estprogress`, `auto-scheduler→scheduler`, `estimate-analysis→estanalysis`, `table→table`, `flow-metrics→flow`, `time-in-status→tis`, `cards→cards`, `report-of-reports→ror`. Anything else → `{ key, name: key, tone: 'neutral' }`.

- [ ] **Step 1: Write the failing test**

```ts
import { reportTypeMeta } from './report-type-meta';

describe('reportTypeMeta', () => {
  it('maps a known key to its config name and a tone', () => {
    expect(reportTypeMeta('start-due')).toEqual({ key: 'start-due', name: 'Gantt Chart', tone: 'gantt' });
    expect(reportTypeMeta('due').tone).toBe('scatter');
    expect(reportTypeMeta('report-of-reports')).toEqual({
      key: 'report-of-reports',
      name: 'Report of Reports',
      tone: 'ror',
    });
  });

  it('falls back neutrally for an unknown or missing key', () => {
    expect(reportTypeMeta('mystery')).toEqual({ key: 'mystery', name: 'mystery', tone: 'neutral' });
    expect(reportTypeMeta(undefined).tone).toBe('neutral');
    expect(reportTypeMeta(null).tone).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails** — `npm run test -- report-type-meta` → FAIL (module not found).
- [ ] **Step 3: Implement** the map: a `Record<string, ReportTypeTone>` of tones, and pull `name` from `reports.find(r => r.key === typeKey)?.name ?? typeKey`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: `npm run typecheck`.**
- [ ] **Step 6: Commit** — `feat(report-modal): shared reportTypeMeta map`.

---

## Task 2: `describeReport` — Report → view-model

**Files:**

- Create: `src/react/reports/ReportOfReports/model/describe-report.ts`
- Test: `src/react/reports/ReportOfReports/model/describe-report.test.ts`

**Interfaces:**

- Consumes: `Report` from [src/jira/reports](../../src/jira/reports); `reportTypeMeta` (Task 1).
- Produces:

  ```ts
  export interface DescribedReport {
    report: Report;
    typeKey: string; // primaryReportType, or '' if absent
    typeName: string; // reportTypeMeta(...).name
    tone: ReportTypeTone;
    jql: string; // '' if absent
  }
  export const describeReport: (report: Report) => DescribedReport;
  ```

  Parse `report.queryParams` with `new URLSearchParams(report.queryParams ?? '')`; read `primaryReportType` and `jql`. Mirrors the parsing already in [selectable-reports.ts](../../src/react/reports/ReportOfReports/model/selectable-reports.ts).

- [ ] **Step 1: Write the failing test**

```ts
import { describeReport } from './describe-report';

const report = (queryParams: string) => ({ id: 'a', name: 'Alpha', queryParams });

describe('describeReport', () => {
  it('pulls type and jql out of queryParams', () => {
    const d = describeReport(report('primaryReportType=due&jql=project%3DECOM'));
    expect(d.typeKey).toBe('due');
    expect(d.typeName).toBe('Scatter Plot');
    expect(d.jql).toBe('project=ECOM');
  });

  it('tolerates missing params', () => {
    const d = describeReport(report(''));
    expect(d.typeKey).toBe('');
    expect(d.jql).toBe('');
    expect(d.tone).toBe('neutral');
  });
});
```

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement.**
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: `npm run typecheck`.**
- [ ] **Step 6: Commit** — `feat(report-modal): describeReport view-model`.

---

## Task 3: `<ReportTypeIcon>` — the shared tinted icon tile

**Files:**

- Create: `src/react/components/ReportTypeIcon/ReportTypeIcon.tsx`, `index.ts`
- Test: `src/react/components/ReportTypeIcon/ReportTypeIcon.test.tsx`

**Interfaces:**

- Consumes: `ReportTypeTone` (Task 1).
- Produces:

  ```ts
  export interface ReportTypeIconProps {
    tone: ReportTypeTone;
    label?: string;
    size?: number;
  }
  export const ReportTypeIcon: FC<ReportTypeIconProps>;
  ```

  A 32×32 (default) rounded tile with a tone-based background/foreground, containing the inline SVG for that tone. SVG paths are copied verbatim from the legend in [mockups/add-report-modal.html](./mockups/add-report-modal.html) (gantt bars, scatter loose dots, estimation-progress pill, **scheduler = six-bar histogram bell**, estimation-analysis bars-under-magnifier, table grid, **flow = double chevron**, time-in-status stopwatch, cards 2×2, report-of-reports doc-behind-doc, neutral fallback = generic document). Tone colors reuse the Atlaskit token families in the mockup's `:root`.

- [ ] **Step 1: Write the failing test**

```tsx
import { render } from '@testing-library/react';
import { ReportTypeIcon } from './ReportTypeIcon';

it('renders an svg for a known tone and is decorative by default', () => {
  const { container } = render(<ReportTypeIcon tone="gantt" />);
  expect(container.querySelector('svg')).toBeInTheDocument();
});

it('exposes a label when given one', () => {
  const { getByLabelText } = render(<ReportTypeIcon tone="cards" label="Cards" />);
  expect(getByLabelText('Cards')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run it and confirm it fails.**
- [ ] **Step 3: Implement** — a `tone → { className, svg }` lookup; wrapper `<span role={label ? 'img' : undefined} aria-label={label} aria-hidden={!label}>`.
- [ ] **Step 4: Run it and confirm it passes.**
- [ ] **Step 5: `npm run typecheck`.**
- [ ] **Step 6: Commit** — `feat(report-modal): ReportTypeIcon component`.

---

## Task 4: Redesign the modal body — rows with icon + badge

**Files:**

- Modify: `src/react/reports/ReportOfReports/components/AddReportModal.tsx`
- Modify: `src/react/reports/ReportOfReports/components/AddReportModal.test.tsx`

**Interfaces:**

- Consumes: `describeReport` (Task 2), `reportTypeMeta` (Task 1), `<ReportTypeIcon>` (Task 3). Props unchanged: `{ isOpen, reports, onSelect, onClose }`.
- Produces: same `onSelect(report.id)` behavior via a new row layout.

Each row is a single button: `<ReportTypeIcon tone={d.tone} />`, the name, the type badge (`d.typeName`, tone-colored), and a truncated `d.jql` on a second line. **Set the button's accessible name to `report.name`** (via `aria-label={report.name}`) so the badge/jql text doesn't pollute it.

- [ ] **Step 1: Update the existing tests for the new DOM.** Keep `getByRole('button', { name: 'Alpha' })` working (that's why `aria-label` is set). Add:

```tsx
it('shows each report’s type as a badge', async () => {
  renderModal({
    reports: [{ id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' }],
  });
  expect(await screen.findByText('Scatter Plot')).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the modal tests and confirm the new one fails** (badge not rendered yet).
- [ ] **Step 3: Implement** the row layout using the view-model. Keep the empty-state copy ("No other saved reports to add…") exactly.
- [ ] **Step 4: Run the modal tests and confirm all pass.**
- [ ] **Step 5: `npm run typecheck`.**
- [ ] **Step 6: Commit** — `feat(report-modal): rows with type icon and badge`.

---

## Task 5: Client-side search + highlight + no-results

**Files:**

- Modify: `src/react/reports/ReportOfReports/components/AddReportModal.tsx`
- Modify: `src/react/reports/ReportOfReports/components/AddReportModal.test.tsx`

**Interfaces:**

- Consumes: the described view-model list from Task 4.
- Produces: no prop change. Internal `query` state filters the list.

Add an autofocused `@atlaskit/textfield` at the top. Filter case-insensitively on `report.name` **and** `typeName`. Highlight matched substrings in the name (`<mark>`). Distinguish two empty states: no reports at all (existing copy) vs. a non-empty query matching nothing ("No reports match …").

- [ ] **Step 1: Write failing tests**

```tsx
it('filters by name as the user types', async () => {
  renderModal({
    reports: [
      { id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' },
      { id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' },
    ],
  });
  await userEvent.type(screen.getByRole('textbox'), 'alph');
  expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
});

it('matches on report type too', async () => {
  renderModal({ reports: [{ id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' }] });
  await userEvent.type(screen.getByRole('textbox'), 'table');
  expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
});

it('shows a search-specific empty state when nothing matches', async () => {
  renderModal();
  await userEvent.type(screen.getByRole('textbox'), 'zzz');
  expect(screen.getByText(/No reports match/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run them and confirm they fail.**
- [ ] **Step 3: Implement** search state, filtering, highlight, and the two empty states.
- [ ] **Step 4: Run them and confirm they pass.**
- [ ] **Step 5: `npm run typecheck`.**
- [ ] **Step 6: Commit** — `feat(report-modal): searchable report picker`.

---

## Task 6 (stretch): Keyboard navigation

**Files:** Modify `AddReportModal.tsx` + its test.

Arrow ↑/↓ move an `activeIndex`, `Enter` selects the active row (`onSelect`), `Escape` closes. Works with the filtered list; resets to 0 on query change. Only pursue after Tasks 1–5 are green; it is independently shippable and independently rejectable.

- [ ] Write a failing test: typing then `Enter` calls `onSelect` with the top filtered report's id.
- [ ] Run → fail. Implement. Run → pass. `npm run typecheck`. Commit — `feat(report-modal): keyboard navigation`.

---

## Out of scope (future spec)

Save metadata (`updatedAt`, `updatedBy`), the "Recently updated" sort, and richer Saved Reports columns require a `Report` schema change + migration tolerance and are tracked in [README.md](./README.md) § "What we don't have." Do **not** build them here. Because Tasks 1–3 are shared, a later spec can reuse `reportTypeMeta` / `<ReportTypeIcon>` on the Saved Reports page and the report-type dropdown for free.

## Verification (before claiming done)

- [ ] `npm run test -- ReportOfReports report-type-meta describe-report ReportTypeIcon AddReportModal` all green.
- [ ] `npm run typecheck` clean.
- [ ] Manually: open a report-of-reports, click **Add Report** — search filters live, every row shows the right icon + badge, no-results and empty states read correctly, Cancel/close still work.
