# 009 — Type-inclusion reporting (motivating case: RAID)

> Status: **Exploration**. This doc houses ideas and open questions. It stays at
> the concept level on purpose — no field names, component names, or data-flow
> steps yet. Those come after we pick a direction.

## The generic capability

The real feature is **type-inclusion reporting**: let a viewer choose
work-item types that aren't part of the normal delivery hierarchy and have those
items **roll up** through reporting levels and **show on report cards**.

RAID is the motivating example, not the feature. Folks could use the same
mechanism for all sorts of inclusionary reporting:

- **RAID / decisions** — Risks, Assumptions, Issues, Dependencies, Decisions,
  Considerations.
- **Milestones / key dates** filed as their own type.
- **Blockers or escalations** raised as a dedicated type.
- **Spikes, research, or discovery** items surfaced separately from delivery.
- Anything a team models as its own Jira type and wants visible above the level
  it was entered.

So the design goal is a **general mechanism** — "pick types to include, decide how
far they travel, show them on cards" — that RAID happens to be the first user of.

## Problem

Reports today roll up **schedule and status** (dates, percent complete,
blocked/warning) from children to parents. Anything a team files as a _different_
kind of work — a risk, a decision, a milestone — dies at the level it was entered.
A viewer looking at an initiative card can't see it without drilling in.

## User value

- A card can answer more than "is it on track?" — it can carry whatever the team
  has chosen to surface (risks, decisions, milestones…).
- Teams keep using normal Jira issues; no new tooling.
- The viewer tunes the signal: which types, and how much of each.

## What the viewer expresses

At the concept level, the viewer is making three choices:

1. **Which types to include** (e.g. Risk, Decision).
2. **How much of each** — some threshold or filter that decides which items are
   worth surfacing and how far up they travel (e.g. "only Critical ones", "only
   these labels").
3. **Where they appear** — on the secondary report cards, grouped by type.

The RAID phrasing "show all Risk types that are Critical" is just choices 1 + 2
together.

## Roughly what a card gains

A new section on the card, grouped by included type, each entry a short line:

```
Target Date {date}
{statusSummary}

Risks
- {first risk summary}
- {second risk summary}

Decisions
- {a decision summary}

{colorStatus A} {child work item A}
{colorStatus B} {child work item B}
```

The section header names the included type; entries are the items of that type
that cleared the viewer's threshold and reached this card's level.

## Card builder (emerging umbrella framing)

The RAID card above is really one instance of a more general idea: a
**configurable card**. Rather than hard-code what a card shows, let folks compose
it. Under this framing RAID stops being _the_ feature and becomes a driving
example; type-inclusion filtering and field loading become the enabling layers
underneath.

> This is a candidate organizing frame for the whole effort, not a decided one.
> It's captured here alongside the narrower type-inclusion idea so we can choose
> later.

### A card as a stack of blocks

A card renders one **primary issue** and is an ordered stack of **blocks**. Two
families seem to cover everything discussed:

- **Value block** — displays _one_ derived value of the primary issue.
  - **Source:** a field — native (target date), computed (rollup status), a loaded
    custom field, or `statusSummary`.
  - **Presentation:** how to render it — date, ADF/text, a colored status pill, a
    chip.
- **List block** — displays a _collection_ of related elements.
  - **Selection:** which elements — the primary's children (today's behavior), or
    elements chosen by a filter (type, label, priority…), or rolled-up/percolated
    items (RAID).
  - **Per-element presentation** (the "expression"): each element as a label plus a
    status indicator **colored by a chosen dimension** — rollup status / jira
    status / priority / breakdown status.
  - **Grouping (optional):** split the list by a field → sub-headers ("Risks",
    "Decisions").

### Why this unifies everything

The features that already exist become **presets** of the builder rather than
separate code paths:

- **Status mode** = target-date value block + statusSummary value block + a list
  block (children, colored by rollup status).
- **Breakdown mode** = a list block (children, presented as the design/dev/qa/uat
  matrix).
- **RAID** = a list block (selection `type in (Risk, Decision)`, grouped by type,
  colored by priority).

And the other threads slot in as the enabling layers: **field loading** feeds the
Source picker and the fields a filter can name; the **filter-loaded expression**
powers List-block selection; **rollup/percolation** lets a list block pull items
from below the primary.

### Two reusable seams worth naming

- **A "colorer"** — `element → { color, label }`. rollup-status / jira-status /
  priority / breakdown are all instances of one pluggable interface; new coloring
  dimensions become new colorers, not new card code. (Priority coloring needs a
  priority→color map, and priority isn't loaded today.)
- **A "selection"** — `{ scope, filter, groupBy?, colorBy?, sort? }`, where
  "children" is just `scope: children` and RAID is `scope: descendants + filter:
type in (Risk)`. Selection and the filter-loaded expression become the same
  thing.

### The tension to keep honest

A _fully_ arbitrary card builder is a large surface — it can drift into a mini-BI
tool. The YAGNI-guarded version is a **fixed, small set of block types with
bounded config**, where the existing modes are the first presets and RAID proves
it generalizes. How far "arbitrary" goes is an early decision, not a late one.

## The two questions the design has to answer

Everything else is plumbing. These two are the actual decisions.

### 1. Percolation — what makes an item travel up, and how far?

The report already has a rollup pass that walks the hierarchy bottom-up
([`src/jira/rollup/`](../../src/jira/rollup/)), so "collect matching items from a
node and its children" fits an established pattern. The open question is the
_signal_:

- **Priority-based** — an item rises as far as its priority earns ("Critical" goes
  to the top). Matches the RAID phrasing well. Note: Jira priority isn't fetched
  in this repo today, so this is net-new fetch/normalize work.
- **Label-based** — a label promotes an item. Labels are already available, so
  cheapest, but there's no natural "how critical" gradient.
- **Include-all, narrow at the view** — everything of an included type travels to
  every ancestor; the viewer's filter does all the narrowing. Simplest rollup,
  but can over-surface minor items on high-level cards.
- **Explicit escalation field** — a field caps how high an item goes. Most
  precise, most Jira-admin overhead.

These aren't exclusive — a first cut could include-all and let the viewer filter,
then add a priority threshold later.

### 2. Selection — how does the viewer pick types (and threshold)?

The report already has a generalized, viewer-facing filter system with
secondary-report-scoped rows
([`src/react/ReportControls/components/Filters/`](../../src/react/ReportControls/components/Filters/),
[`filter-rows.ts`](../../src/jira/rollup/filter-rows/filter-rows.ts)). Today it
filters on status only. Type-inclusion selection is conceptually the same shape —
"type is one of X (and priority/label is Y)" — so it likely extends this rather
than inventing a new control. Whether it's a third filter surface or a friendlier
dedicated control is a UX call for the design phase.

## Generic filtering & field loading

The selection question surfaced a bigger, more generally useful idea: a **generic
capability to filter the already-loaded set on arbitrary Jira fields**, including
custom fields. Type-inclusion is one consumer; grouping, other reports, and future
features are others.

### Load vs. filter-loaded — two different things

This distinction is the whole ballgame and easy to conflate:

- **Load JQL** (`routeData.jql` / `childJQL`) — free-text JQL the user writes in
  the [JqlTextArea](../../src/react/SettingsSidebar/components/IssueSource/components/JqlTextArea/index.ts),
  run **once, server-side**, to define _what gets pulled from Jira_. It does not
  filter the set afterward.
- **Filter-loaded** (`jiraStatus` / `rollupStatus` filter rows,
  [filter-rows.ts](../../src/jira/rollup/filter-rows/filter-rows.ts)) — runs
  **client-side, after rollup**, narrowing what's already in memory. Today limited
  to two fields with is / is-not equality.

The gap: there is **no expressive way to filter the loaded set**. A query like
`priority = critical and type in (Risk, Decision)` is a _filter-loaded_
expression, and nothing supports it yet.

### Options for expressive filter-loaded

- **Extend the structured filter rows** — add `priority`, `type`, `labels` (and an
  `in` operator) as fields. Cheapest, keeps the dropdown UI, no parser. Logic
  ceiling is low (AND-of-rows, OR-within-row); never `(a and b) or c`.
- **A client-side filter expression (JQL-subset evaluator)** — accept text like
  `priority = critical and type in (Risk, Decision)` and evaluate it against the
  loaded, normalized issues. A _pragmatic subset_ (`field op value`, `= != in
"not in" > <`, `and`/`or`, parens) is bounded — not a full JQL clone.
  **Property the others can't match:** because it's our evaluator over our
  normalized model, one expression can mix **native Jira fields and computed
  fields** — e.g. `type in (Risk) and rollupStatus = behind`. Jira's JQL can't see
  computed fields; the current rows can't do free-form boolean.
- **Re-query Jira and intersect by key** — send the expression to Jira, keep
  loaded items whose key returns. No parser, full native JQL, but a round-trip,
  can't reference computed fields, and risks drift vs. the reconstructed set.

**Leaning:** a deliberately-small client-side expression evaluator — it matches
the syntax users would write and is the only option that unifies native +
computed filtering. Extending structured rows is a fine shippable stepping stone.
Do **not** build a full client-side JQL engine.

### Field loading is the prerequisite layer

You cannot filter on a field you never loaded, and today only `CORE_FIELDS` come
down. Loading, normalizing, and referencing are **three coupled steps** — a field
must clear all three to be filterable:

1. **Request** — union the field into the fetch. The plumbing exists:
   [`getRawIssues`](../../src/stateful-data/jira-data-requests.js) already merges a
   `fields` param with `CORE_FIELDS`, and `routeData.allFieldsToRequest` combines
   team/normalize config with a URL `fields` param.
2. **Normalize** — the sharp edge. `CORE_FIELDS` become typed `NormalizedIssue`
   properties, but an arbitrary custom field returns a **raw Jira value** of
   unknown shape (string, number, option `{ value }`, user object, array).
   Filtering needs a generic accessor + type-aware comparison, not string
   equality.
3. **Reference** — name it in the filter expression.

**Reusable UI already exists.** The Grouping report's
[`SelectAdditionalFields`](../../src/react/reports/GroupingReport/components/SelectAdditionalFields.tsx)
("Additional Fields to Include") is a multi-select backed by the full Jira field
catalog (`useJiraIssueFields()` → all fields incl. custom) that writes chosen
field **names** into an `extraFields` observable
([GroupingReport.tsx](../../src/react/reports/GroupingReport/GroupingReport.tsx)).
It already solves discovery + selection + requesting. Caveats: it keys on field
**name** (not id), and it stops at _loading_ — it does no normalization into
comparable values, because grouping/aggregation consume the raw values directly.

So "let users load arbitrary custom fields" is not a separate feature from
filtering — it is the layer underneath it. The clean shape: reuse the
`SelectAdditionalFields` / field-catalog pattern for the load step, add a generic
normalizer/accessor so custom values become comparable, then let the filter
expression reference them.

### Ideal: auto-load referenced fields (no manual "fields to load" step)

The Grouping report's model — _first_ pick your extra fields, _then_ use them —
is the UX we'd rather avoid. Ideally folks just write a filter (or configure a
card block), and the tool notices a referenced field isn't loaded yet and
**reloads automatically** to fetch it. Field loading becomes an implementation
detail, not a step the user manages.

Mechanically this is plausible: an expression references fields by name; diff that
set against what's currently loaded; if anything's missing, add it to the fetch
union and re-request. The `fields` union + re-fetch machinery already exists — the
new part is (a) extracting referenced field names from an expression/config and
(b) triggering a reload when the referenced set grows.

Costs / caveats to weigh:

- Auto-reload means a filter edit can trigger a (potentially slow) refetch —
  needs clear loading feedback and probably debouncing.
- A typo'd or unknown field name has to fail gracefully (validate against the
  field catalog before triggering a fetch).
- Historical/changelog reconstruction is expensive; adding a field mid-session
  may re-pull a lot.

### The discoverability tension (unresolved)

Listing **all** Jira fields (the Grouping report's approach) is a lot to wade
through — poor UX. But the alternative extremes don't work either:

- **A global "fields to load" setting** doesn't fit — which fields matter is
  **report-** and even **block-specific**, not a workspace constant.
- **Making users hand-pick fields up front** is the very step we want to remove
  (see auto-load above).

So there's an unresolved tension: _how does a user discover/choose which fields to
reference without being shown everything, and without a manual global list?_
Possible directions to explore later (none chosen):

- Auto-load by reference (above) sidesteps _pre_-selection entirely, but the user
  still needs autocomplete/discovery _while writing_ an expression.
- Autocomplete scoped/ranked to fields actually present on the loaded issues, or
  recently/commonly used, rather than the full catalog.
- Surface fields contextually where they're used (per report/per block) instead of
  one global picker.

## Open questions

- [ ] **Modeling:** Are included types a _hierarchy level_ (they sit in the
      epic→story→… ladder) or an _orthogonal tag/type_ that can attach at any level?
      This decides how they enter the rollup graph.
- [ ] **Linkage:** How is an included item connected to the work it relates to —
      Jira parent/child, issue link, shared parent? Determines whether it's reachable
      through the existing rollup traversal or needs a second one. This is the biggest
      effort risk.
- [ ] **Percolation signal:** priority / label / include-all / explicit field (or
      a mix)?
- [ ] **Do included items pollute existing rollups?** A risk isn't deliverable
      work — it should almost certainly be excluded from dates / percent-complete
      rollups. Confirm.
- [ ] **Selection UX:** extend the existing filter rows, or a dedicated "pick
      types + threshold" control? And is "which types are includable" a global config
      vs. "which to show" a per-report choice?
- [ ] **Filter-loaded approach:** structured rows / client-side expression
      evaluator / re-query-and-intersect? If an expression, how big a grammar subset,
      and does it reuse JQL field names or define its own vocabulary (so `rollupStatus`
      can be first-class)?
- [ ] **Field loading:** reuse the Grouping report's `SelectAdditionalFields` /
      `extraFields` pattern, or generalize it into a shared control? Key on field
      **name** (as today) or migrate to field **id**?
- [ ] **Custom-field normalization:** how do we turn arbitrary raw Jira field
      values (option `{ value }`, user objects, arrays, numbers) into comparable values
      the filter can operate on generically?
- [ ] **Card-builder scope:** do we pursue the full configurable-card umbrella, or
      ship RAID/type-inclusion narrowly first and generalize later? How far does
      "arbitrary" go before it's a mini-BI tool?
- [ ] **Card-builder framing:** are the existing status/breakdown modes actually
      reimplemented as builder presets, or does the builder sit alongside them?
- [ ] **Block config persistence & scope:** where does a card's block configuration
      live — per report, per view, saved/shareable? Per-user or per-workspace?
- [ ] **Colorer / selection abstractions:** are "colorer" (`element → {color,
label}`) and "selection" (`{scope, filter, groupBy, colorBy, sort}`) the right
      seams, and is "children" genuinely just `scope: children`?
- [ ] **Auto-load referenced fields:** feasible/desirable to auto-detect
      referenced-but-unloaded fields and reload? How to handle reload latency,
      debouncing, feedback, and invalid field names?
- [ ] **Field discoverability:** how does a user find/choose fields to reference
      without being shown the entire catalog and without a manual global list —
      autocomplete scoped to loaded/common fields? contextual per-block surfacing?
- [ ] **What shows per entry:** summary only? + status swatch? + priority/label
      chip? + link?
- [ ] **Which report modes / reports:** secondary report only? status mode only,
      or the matrix mode too? Primary report later?
- [ ] **Overflow / de-dup:** cap long lists on high-level cards; show an item once
      if reachable via multiple paths.
- [ ] **Naming & scope:** is this shipped as a generic "included types" feature
      with RAID as documentation, or surfaced to users as a RAID feature specifically?

## Effort & risk (rough, pre-decision)

- Cheapest coherent slice — include-all percolation, filter by type at the view,
  reuse the existing filter and rollup machinery, no new Jira fetch: small–medium.
- Adding a priority threshold pulls in new fetch/normalize work: medium.
- Main risk is the modeling/linkage question — if included items aren't reachable
  through the existing parent graph, the rollup grows a second traversal.

## Related prior art in this repo

- [`spec/007-secondary-improvements/`](../../spec/007-secondary-improvements/) —
  maps the secondary-report subsystem; its filter and status-summary sub-specs are
  the closest cousins.
- [`spec/006-work-breakdown-improvements/`](../../spec/006-work-breakdown-improvements/)
  — the card design this builds on.
