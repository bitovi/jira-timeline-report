# Idea 3 — Status Summary from a custom Jira field (read + write)

> One of five competing **summary source** approaches. Long-term, all sources are meant to
> render through [Idea 2 — Summary card display](../summary-card-display/requirements.md), but
> this plan ships a standalone `Card.statusSummary` / `StatusSummaryBody` now and defers
> reconciling with the Idea 2 shared surface until a second source is built.
> Implementation plan: [plan.md](./plan.md).

## Problem

We want an author-controlled, high-signal narrative per initiative that lives **in Jira** (so it
survives outside the report and is editable by anyone with Jira access). A dedicated custom
field — e.g. a paragraph field named "Status Summary" — is the cleanest home for this.

## User value

- The summary is structured, first-class Jira data — not buried in comment history.
- Read is cheap and rate-limit-safe (it comes back with the normal issue fetch).
- Optional write-back lets the reader edit the summary from the report (see also
  [Idea 4](../user-typed-summary/requirements.md)).
- No comment parsing, no AI cost.

## How it might work

### Field selection — reuse Team Configuration

The **Team Configuration** panel already maps Jira fields to concepts (`estimateField`,
`startDateField`, `dueDateField`, `confidenceField`). Add a new **`statusSummaryField`** there
rather than inventing a new route param:

- Config lives in `Configuration`
  ([`shared.ts`](../../../src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/shared.ts)),
  picked with the existing `@atlaskit/select` field-picker
  ([`AllTeamsDefaultsForm.tsx`](../../../src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/AllTeamsDefaultsForm.tsx)).
- Auto-detect a sensible default: strict names (`Status Summary`, `Executive Summary`, …) **or**
  any field whose name contains **both** "status" and "summary" — never the bare system `Summary`
  title field.
- Gets global-default + per-team inheritance and stale-field reconciliation for free.

### Read

- The configured field name flows into the fetch automatically via `getAllFields` in
  [`normalize.ts`](../../../src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.ts) —
  no change to `CORE_FIELDS` and no new request.
- A new `getStatusSummary` extractor lands the raw value on `NormalizedIssue.statusSummary`
  ([`normalize.ts`](../../../src/jira/normalized/normalize.ts) +
  [`defaults.ts`](../../../src/jira/normalized/defaults.ts)). Because `DerivedIssue =
NormalizedIssue & {…}`, it rides through derive/rollup to the report.
- Jira paragraph fields return **ADF** (Atlassian Document Format), not plain text. A small
  `adfToText` helper converts it at the report boundary.
- `buildBoard` reads `issue.statusSummary`, converts it, and sets `Card.statusSummary: { text }`
  — a standalone field for this MVP, not the shared Idea 2 `summary` shape (see Questions).
- **Display: additive, not a replacement.** For the MVP, the card shows the status-summary text
  **and** the existing child status swatches (single column or work-type matrix) — the summary
  is inserted above the swatch rows, nothing is hidden. A fast-follow can add a display option
  (summary only / swatches only / both) once there's a place in Team Configuration or the card
  itself to choose it (see Idea 2's "overlay toggle" framing).

### Write (optional, phase 2 — out of scope for the first plan)

- Reuse `editJiraIssueWithNamedFields`
  ([`jira.ts`](../../../src/jira-oidc-helpers/jira.ts) → `fieldsToEditBody` → `PUT` issue). The
  edit body must send **ADF** for a paragraph field, so wrap the typed text in a minimal ADF doc.
- Expose a `useUpdateStatusSummary` mutation in
  [`src/react/services/jira/`](../../../src/react/services/jira/) using `useMutation` +
  optimistic update + query invalidation.
- Requires `write:jira-work` scope (already requested — see `.env` `VITE_JIRA_SCOPE`).

### Config / discoverability

- If no status-summary field is configured, cards render exactly as today (no change at all).
  Configuring the field is the opt-in; once configured, the summary text is added above the
  existing swatches — the swatches themselves are never removed for the MVP.
- Consider a "create the field for me" helper later — out of scope for v1 (needs Jira admin).

## Acceptance criteria

- [ ] User can select which text/paragraph field is the status-summary field in Team
      Configuration; the choice persists (per-team inheritance + stored config).
- [ ] The chosen field is fetched with issues and rendered (ADF converted to readable text) in
      the card body, **above** the existing child status rows / matrix (both are shown together).
- [ ] Cards with an empty field show exactly what they show today (no summary block at all).
- [ ] (Fast follow) A display option lets the user choose summary-only, swatches-only, or both.
- [ ] (Phase 2) User can edit the summary inline and save; the write sends valid ADF, updates
      optimistically, and reflects Jira on refetch.
- [ ] ADF conversion + `getStatusSummary` covered by unit tests.

## Open questions

- Which field types to allow — paragraph (rich, ADF) only, or also short-text (plain)?
- Field history for `updated`/author — is per-field last-edited available without an extra call?
  If not, fall back to issue `updated` and omit author.
- Should the display clamp long summaries (3–4 lines + "more") on dense boards? (Fast follow.)

## Questions

- ~~`Card.summary` vs. `Card.statusSummary`~~ — **Decided:** ship this MVP with its own
  standalone `Card.statusSummary: { text }` and `StatusSummaryBody` (no provenance line, no
  clamping). Reconciling with the shared Idea 2 `Card.summary` surface is deferred until a
  second summary source is actually built — no speculative refactor now.
- ~~Per-team override UI~~ — **Decided:** global-only for the MVP. `statusSummaryField` is set
  once in the **global defaults** form (`AllTeamsDefaultsForm.tsx`, plan Task 6); no
  `InheritanceSelect` is added to the per-team override form (`ConfigureTeamsForm.tsx`). The
  data layer's per-team inheritance/reconciliation (plan Tasks 3–5) still runs harmlessly since
  every team/level simply inherits the global value — it's just not user-overridable per team.
- ~~`adfToText` placement~~ — **Decided:** keep `adfToText` in
  `src/react/reports/WorkBreakdown/helpers/` for this plan. Move it to a shared location only
  if/when a second ADF-consuming idea (exec-summary-comment, pull-comments) is actually built.

## Effort & risk

- **Effort:** Read = Small. Write = Medium (ADF authoring + mutation + optimistic UI).
- **Risk:** Low for read (rate-limit-safe, no comments). Main friction is **org setup**: someone
  must create/standardize the custom field, and it must be populated to be useful.
- **Evaluation notes:** best signal-to-noise and no rate-limit risk; the cost is Jira
  configuration and human authoring discipline.
