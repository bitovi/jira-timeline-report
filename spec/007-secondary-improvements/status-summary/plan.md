# Status Summary Custom Field — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user pick a Jira custom field (a "Status Summary") in settings and show that field's text on each secondary-report card in place of the per-child status swatches.

**Architecture:** Reuse the existing **Team Configuration** field-picker (which already maps Jira fields to concepts like `estimateField`) by adding a new `statusSummaryField`. That field flows automatically into the fetch (`getAllFields`) and into normalization via a new `getStatusSummary` extractor, which lands the raw value on `NormalizedIssue.statusSummary`. Because `DerivedIssue = NormalizedIssue & {…}` and derive/rollup spread the normalized issue, the value rides along to the `WorkBreakdown` report, which converts ADF→text and renders it in the card body.

**Tech Stack:** TypeScript, React, CanJS route-data, TanStack Query, Atlaskit `@atlaskit/select`, Vitest, Storybook.

## Global Constraints

- TypeScript strict mode (`noImplicitAny`, `strictNullChecks`). Prettier: single quotes, 120 print width, 2-space indent.
- New UI must be React (never CanJS). Report components read CanJS observables via `useCanObservable`.
- Tests are colocated Vitest `*.test.ts(x)`. Pure logic uses inline data objects.
- Do NOT add a new route param or a new fetch call. The field must ride the existing issue fetch + normalization pipeline.
- The Jira **system** title field is literally named `"Summary"`. The new concept is a **Status Summary** — never auto-match the bare word "Summary" or you will pick up the title. Auto-detect requires a **status** signal too.

## Naming (used across tasks — keep consistent)

- Product / UI term: **"Status Summary"**.
- Team-config property: `statusSummaryField: string | null` (the Jira field's **name**).
- "Not used" sentinel value: `'status-summary-not-used'`.
- Normalized field: `NormalizedIssue.statusSummary: string | Record<string, unknown> | null` (raw ADF object or plain string).
- Normalize getter (config key): `getStatusSummary`; its default export: `getStatusSummaryDefault`.
- Report type additions: `IssueOrRelease.statusSummary?`, `Card.statusSummary?: { text: string }`.
- Display component: `StatusSummaryBody`. Display helper: `adfToText(value: unknown): string`.

## Display rule (the product behavior)

- No `statusSummaryField` configured → cards render exactly as today (no regression).
- `statusSummaryField` configured **and** the primary issue has non-empty text → the card body renders the status-summary text **above** the existing status column / matrix — both are shown together. The colored header bubble + title are unchanged.
- `statusSummaryField` configured but a given card has empty text → that card renders exactly as today (no summary block, just the status column / matrix).

No new "mode" or toggle for the MVP: configuring the field is the opt-in, and it's additive (nothing is hidden). A future fast-follow can add an explicit display option (summary-only / swatches-only / both) — see the [requirements](./requirements.md).

---

## Phase A — Pipeline read path

### Task 1: Land the configured field's raw value on `NormalizedIssue.statusSummary`

**Files:**

- Modify: `src/jira/shared/types.ts` (add field to `NormalizedIssue`, ~line 108–129)
- Modify: `src/jira/normalized/defaults.ts` (add `getStatusSummaryDefault`)
- Modify: `src/jira/normalized/normalize.ts` (add to `optionsWithDefaults` + return object)
- Test: `src/jira/normalized/normalize.statusSummary.test.ts` (create)

**Interfaces:**

- Produces: `NormalizedIssue.statusSummary: string | Record<string, unknown> | null`; config key `getStatusSummary(issue, options?)` defaulting to `null`.

- [ ] **Step 1: Write the failing test**

Create `src/jira/normalized/normalize.statusSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { normalizeIssue } from './normalize';
import type { JiraIssue } from '../shared/types';

const baseFields = {
  Summary: 'A title',
  'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
  Status: { name: 'To Do', statusCategory: { name: 'To Do' } },
} as unknown as JiraIssue['fields'];

const makeIssue = (fields: Partial<JiraIssue['fields']>): JiraIssue =>
  ({ key: 'X-1', fields: { ...baseFields, ...fields } }) as unknown as JiraIssue;

describe('normalizeIssue statusSummary', () => {
  it('defaults to null when no getStatusSummary is configured', () => {
    expect(normalizeIssue(makeIssue({})).statusSummary).toBeNull();
  });

  it('uses the configured getStatusSummary extractor', () => {
    const issue = makeIssue({ 'Status Summary': 'On track for Q3' } as Partial<JiraIssue['fields']>);
    const normalized = normalizeIssue(issue, {
      getStatusSummary: (i) => (i.fields as Record<string, unknown>)['Status Summary'] ?? null,
    });
    expect(normalized.statusSummary).toBe('On track for Q3');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/jira/normalized/normalize.statusSummary.test.ts`
Expected: FAIL — `statusSummary` is `undefined` / `getStatusSummary` not a known option.

- [ ] **Step 3: Add the field to the `NormalizedIssue` type**

In `src/jira/shared/types.ts`, inside `export interface NormalizedIssue { … }` (after `rank`):

```ts
  rank: string | null;
  /** Raw value of the configured "Status Summary" field (ADF object or plain string). */
  statusSummary: string | Record<string, unknown> | null;
}
```

- [ ] **Step 4: Add the default getter**

In `src/jira/normalized/defaults.ts`, add near the other getters:

```ts
export function getStatusSummaryDefault(
  _issue: Fields,
  _options?: Pick<NormalizeIssueConfig, 'getTeamKey' | 'getType' | 'getHierarchyLevel'>,
): NormalizedIssue['statusSummary'] {
  return null;
}
```

> `NormalizeIssueConfig` is derived from every `*Default` export via the `DefaultsToConfig` mapped type, so this export automatically adds a `getStatusSummary` config option.

- [ ] **Step 5: Wire it into `normalizeIssue`**

In `src/jira/normalized/normalize.ts`, add to `optionsWithDefaults` (next to `getSummary`):

```ts
    getSummary: defaults.getSummaryDefault,
    getStatusSummary: defaults.getStatusSummaryDefault,
```

and add to the returned object (next to `summary`):

```ts
    summary: optionsWithDefaults.getSummary(issue),
    statusSummary: optionsWithDefaults.getStatusSummary(issue, optionsWithDefaults),
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `npm run test -- src/jira/normalized/normalize.statusSummary.test.ts`
Expected: PASS

- [ ] **Step 7: Typecheck**

Run: `npm run typecheck`
Expected: no new errors. (If other constructors of `NormalizedIssue` literals exist in tests, they now need `statusSummary`; add `statusSummary: null` to any that fail.)

- [ ] **Step 8: Commit**

```bash
git add src/jira/shared/types.ts src/jira/normalized/defaults.ts src/jira/normalized/normalize.ts src/jira/normalized/normalize.statusSummary.test.ts
git commit -m "feat(normalize): add statusSummary extractor + field"
```

---

### Task 2: Feed the configured `statusSummaryField` into fetch + normalization

**Files:**

- Modify: `src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.ts` (`getAllFields` + `createNormalizeConfiguration`)
- Test: `src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.statusSummary.test.ts` (create)

**Interfaces:**

- Consumes: `Configuration.statusSummaryField` (added in Task 3 — until then, `config?.statusSummaryField` is typed `never`; this task is written to compile once Task 3 lands, so **do Task 3 first if you hit a type error**, or land them together).
- Produces: the configured field name is added to `fields` (so it is fetched) and a `getStatusSummary` extractor reads `issue.fields[statusSummaryField]`.

- [ ] **Step 1: Write the failing test**

Create `.../Teams/shared/normalize.statusSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { createNormalizeConfiguration } from './normalize';
import type { AllTeamData } from '../services/team-configuration';

const allData = {
  __GLOBAL__: {
    defaults: {
      sprintLength: 10,
      velocityPerSprint: 21,
      tracks: 1,
      spreadEffortAcrossDates: false,
      estimateField: null,
      confidenceField: null,
      startDateField: null,
      dueDateField: null,
      statusSummaryField: 'Status Summary',
    },
  },
} as unknown as AllTeamData;

describe('createNormalizeConfiguration statusSummary', () => {
  it('requests the configured status summary field', () => {
    expect(createNormalizeConfiguration(allData).fields).toContain('Status Summary');
  });

  it('extracts the field value via getStatusSummary', () => {
    const config = createNormalizeConfiguration(allData);
    const issue = { fields: { 'Status Summary': 'Shipping Friday' } } as never;
    expect(config.getStatusSummary?.(issue, config as never)).toBe('Shipping Friday');
  });

  it('returns null when the field is unset or the sentinel is used', () => {
    const none = {
      __GLOBAL__: { defaults: { ...allData.__GLOBAL__.defaults, statusSummaryField: 'status-summary-not-used' } },
    } as unknown as AllTeamData;
    const config = createNormalizeConfiguration(none);
    const issue = { fields: { 'Status Summary': 'ignored' } } as never;
    expect(config.getStatusSummary?.(issue, config as never)).toBeNull();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.statusSummary.test.ts"`
Expected: FAIL — field not requested / `getStatusSummary` undefined.

- [ ] **Step 3: Add the field to `getAllFields`**

In `.../Teams/shared/normalize.ts`, inside `getAllFields`, extend the pushed fields:

```ts
allFields = [
  ...allFields,
  config?.estimateField ?? '',
  config?.confidenceField ?? '',
  config?.startDateField ?? '',
  config?.dueDateField ?? '',
  config?.statusSummaryField ?? '',
];
```

- [ ] **Step 4: Add the extractor to `createNormalizeConfiguration`**

In the returned object of `createNormalizeConfiguration`, add (next to `getDueDate`):

```ts
    getStatusSummary: (issue, config) => {
      const teamHierarchyConfiguration = getConfiguration(
        allData,
        config?.getTeamKey(issue),
        config?.getHierarchyLevel(issue),
      );

      const field = teamHierarchyConfiguration.statusSummaryField;

      if (!field || field === 'status-summary-not-used') {
        return null;
      }

      return issue.fields[field] ?? null;
    },
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.statusSummary.test.ts"`
Expected: PASS (requires Task 3's `statusSummaryField` on `Configuration` to typecheck).

- [ ] **Step 6: Commit**

```bash
git add "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.ts" "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize.statusSummary.test.ts"
git commit -m "feat(teams): request + extract status summary field"
```

---

## Phase B — Settings field picker (Team Configuration)

### Task 3: Add `statusSummaryField` to the `Configuration` model

**Files:**

- Modify: `.../team-configuration/team-configuration/shared.ts` (`Configuration` + `createEmptyConfiguration`)

**Interfaces:**

- Produces: `Configuration.statusSummaryField: string | null`.

- [ ] **Step 1: Extend the type**

In `shared.ts`, add to `Configuration`:

```ts
dueDateField: string | null;
statusSummaryField: string | null;
spreadEffortAcrossDates: boolean | null;
```

- [ ] **Step 2: Extend the empty factory**

In `createEmptyConfiguration`:

```ts
    dueDateField: null,
    statusSummaryField: null,
    spreadEffortAcrossDates: null,
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: errors point at `getGlobalDefaultData` (Task 4) and the form (Task 6) — those are handled next. No unrelated errors.

- [ ] **Step 4: Commit**

```bash
git add "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/shared.ts"
git commit -m "feat(teams): add statusSummaryField to Configuration"
```

---

### Task 4: Default + global-default resolution for `statusSummaryField`

**Files:**

- Modify: `.../team-configuration/team-configuration/allTeamDefault.ts`
- Test: `.../team-configuration/team-configuration/allTeamDefault.statusSummary.test.ts` (create)

**Interfaces:**

- Consumes: `Configuration.statusSummaryField` (Task 3).
- Produces: `getGlobalDefaultData(...).statusSummaryField` — auto-detect by strict names **or** any field whose name contains both "status" and "summary" (never the bare "Summary" title field); else `null` or the user's stored value.

- [ ] **Step 1: Write the failing test**

Create `allTeamDefault.statusSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { getGlobalDefaultData } from './allTeamDefault';
import type { AllTeamData, IssueFields } from './shared';

const fields = (names: string[]): IssueFields =>
  names.map((name, i) => ({
    name,
    id: `id${i}`,
    key: `k${i}`,
    schema: {},
    custom: true,
    clauseNames: [],
    searchable: true,
    navigable: true,
    orderable: true,
  }));

const empty = { __GLOBAL__: { defaults: {} } } as unknown as AllTeamData;

describe('getGlobalDefaultData statusSummaryField', () => {
  it('auto-detects a field literally named "Status Summary"', () => {
    expect(getGlobalDefaultData(empty, fields(['Summary', 'Status Summary'])).statusSummaryField).toBe(
      'Status Summary',
    );
  });

  it('auto-detects any field whose name contains both "status" and "summary"', () => {
    expect(getGlobalDefaultData(empty, fields(['Delivery Status — Summary'])).statusSummaryField).toBe(
      'Delivery Status — Summary',
    );
  });

  it('falls back to a strict "Executive Summary" name', () => {
    expect(getGlobalDefaultData(empty, fields(['Executive Summary'])).statusSummaryField).toBe('Executive Summary');
  });

  it('never auto-selects the system "Summary" title field', () => {
    expect(getGlobalDefaultData(empty, fields(['Summary'])).statusSummaryField).toBeNull();
  });

  it('keeps a valid user-chosen field', () => {
    const withUser = { __GLOBAL__: { defaults: { statusSummaryField: 'Status Note' } } } as unknown as AllTeamData;
    expect(getGlobalDefaultData(withUser, fields(['Status Note'])).statusSummaryField).toBe('Status Note');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/allTeamDefault.statusSummary.test.ts"`
Expected: FAIL — `statusSummaryField` missing from returned defaults.

- [ ] **Step 3: Add a bespoke getter (strict names OR the status+summary AND-fragment)**

`createDefaultJiraFieldGetter`'s `nameFragments` array OR-matches across fragments (any field containing _any one_ fragment) — it can't require a field to contain **both** "status" and "summary". Write a dedicated resolver in `allTeamDefault.ts`, next to `getDueDateField`:

```ts
const STATUS_SUMMARY_STRICT_NAMES = ['Status Summary', 'Executive Summary', 'Exec Summary', 'Status Note'];

const getStatusSummaryField = (userData: Partial<Configuration>, jiraFields: IssueFields): string | null => {
  const chosen = userData?.statusSummaryField;

  // Respect an explicit "don't use" choice and any still-valid user selection.
  if (chosen === 'status-summary-not-used') {
    return 'status-summary-not-used';
  }
  if (chosen && jiraFields.some((field) => field.name === chosen)) {
    return chosen;
  }

  // Strict, well-known names (case-insensitive).
  for (const name of STATUS_SUMMARY_STRICT_NAMES) {
    const match = jiraFields.find((field) => field.name.toLowerCase() === name.toLowerCase());
    if (match) {
      return match.name;
    }
  }

  // Any field whose name mentions BOTH "status" and "summary" (never the bare "Summary" title).
  const both = jiraFields.find((field) => {
    const name = field.name.toLowerCase();
    return name.includes('status') && name.includes('summary');
  });

  return both ? both.name : null;
};
```

- [ ] **Step 4: Include it in `nonFieldDefaults` Omit + `getGlobalDefaultData`**

Update the `Omit` union:

```ts
const nonFieldDefaults: Omit<
  Configuration,
  'estimateField' | 'confidenceField' | 'startDateField' | 'dueDateField' | 'statusSummaryField'
> = {
```

Add to the object returned by `getGlobalDefaultData`:

```ts
    dueDateField: getDueDateField(allTeamData.__GLOBAL__?.defaults, jiraFields),
    statusSummaryField: getStatusSummaryField(allTeamData.__GLOBAL__?.defaults, jiraFields),
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/allTeamDefault.statusSummary.test.ts"`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/allTeamDefault.ts" "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/allTeamDefault.statusSummary.test.ts"
git commit -m "feat(teams): default resolution for statusSummaryField"
```

---

### Task 5: Persist / reconcile `statusSummaryField` in `fixAnyNonExistingFields`

**Files:**

- Modify: `.../team-configuration/team-configuration/fetcher.ts`

**Interfaces:**

- Produces: stored `statusSummaryField` values are validated against live Jira fields (and the `'status-summary-not-used'` sentinel is treated as always-existing).

- [ ] **Step 1: Seed the sentinel in `fieldExistMap`**

In `fixAnyNonExistingFields`:

```ts
const fieldExistMap: Record<string, boolean> = {
  'confidence-not-used': true,
  'status-summary-not-used': true,
};
```

- [ ] **Step 2: Add `statusSummaryField` to the reconcile loop**

```ts
      for (const fieldName of ['confidenceField', 'estimateField', 'startDateField', 'dueDateField', 'statusSummaryField'] as const) {
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration/fetcher.ts"
git commit -m "feat(teams): reconcile statusSummaryField against live Jira fields"
```

---

### Task 6: Add the field picker to the Team Configuration form

**Files:**

- Modify: `.../Teams/AllTeamsDefaultsForm.tsx`

**Interfaces:**

- Consumes: `selectableFields` (already built in the form), the `'status-summary-not-used'` sentinel.
- Produces: a "Status summary field" `<Select>` writing `statusSummaryField`.

- [ ] **Step 1: Add the Select (mirrors the optional `confidenceField` pattern)**

In `AllTeamsDefaultsForm.tsx`, after the `dueDateField` `<Select>`:

```tsx
<Select
  name="statusSummaryField"
  label="Status summary field"
  optional
  jiraFields={[
    {
      label: '',
      options: [{ value: 'status-summary-not-used', label: "Don't show a status summary" }],
    },
    { label: 'Fields', options: selectableFields },
  ]}
  control={control}
  onSave={update}
/>
```

- [ ] **Step 2: Verify in Storybook / dev**

Run: `npm run dev` (or Storybook if credential-free). Open Settings → **Teams** → confirm the "Status summary field" dropdown appears with a "Don't show a status summary" option and the list of Jira fields, and that selecting one persists (reopen the panel to confirm).

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add "src/react/SettingsSidebar/components/TeamConfiguration/components/Teams/AllTeamsDefaultsForm.tsx"
git commit -m "feat(teams): status summary field picker"
```

---

## Phase C — Display in the secondary report

### Task 7: `adfToText` helper

**Files:**

- Create: `src/react/reports/WorkBreakdown/helpers/adfToText.ts`
- Modify: `src/react/reports/WorkBreakdown/helpers/index.ts` (export)
- Test: `src/react/reports/WorkBreakdown/helpers/adfToText.test.ts` (create)

**Interfaces:**

- Produces: `adfToText(value: unknown): string` — string passthrough; ADF doc → text with paragraphs joined by `\n`; anything else → `''`.

- [ ] **Step 1: Write the failing test**

Create `adfToText.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { adfToText } from './adfToText';

describe('adfToText', () => {
  it('returns a plain string unchanged (trimmed)', () => {
    expect(adfToText('  hello  ')).toBe('hello');
  });

  it('flattens an ADF doc, joining paragraphs with newlines', () => {
    const adf = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'On track.' }] },
        {
          type: 'paragraph',
          content: [
            { type: 'text', text: 'QA ' },
            { type: 'text', text: 'starts Monday.' },
          ],
        },
      ],
    };
    expect(adfToText(adf)).toBe('On track.\nQA starts Monday.');
  });

  it('returns empty string for null/undefined/other', () => {
    expect(adfToText(null)).toBe('');
    expect(adfToText(undefined)).toBe('');
    expect(adfToText(42)).toBe('');
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/react/reports/WorkBreakdown/helpers/adfToText.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement**

Create `adfToText.ts`:

```ts
interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
}

const isNode = (value: unknown): value is AdfNode =>
  typeof value === 'object' && value !== null && ('type' in value || 'content' in value || 'text' in value);

const blockTypes = new Set(['paragraph', 'heading', 'listItem', 'blockquote', 'codeBlock']);

/** Convert a Jira field value (ADF object or plain string) to display text. */
export const adfToText = (value: unknown): string => {
  if (typeof value === 'string') {
    return value.trim();
  }

  if (!isNode(value)) {
    return '';
  }

  const lines: string[] = [];

  const walk = (node: AdfNode, current: { text: string }) => {
    if (node.text) {
      current.text += node.text;
    }
    for (const child of node.content ?? []) {
      walk(child, current);
    }
  };

  const collectBlocks = (node: AdfNode) => {
    if (node.type && blockTypes.has(node.type)) {
      const acc = { text: '' };
      walk(node, acc);
      if (acc.text.trim()) {
        lines.push(acc.text.trim());
      }
      return;
    }
    for (const child of node.content ?? []) {
      collectBlocks(child);
    }
  };

  collectBlocks(value);
  return lines.join('\n').trim();
};
```

- [ ] **Step 4: Export it**

In `helpers/index.ts`:

```ts
export { buildExploreUrl } from './buildExploreUrl';
export { adfToText } from './adfToText';
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/react/reports/WorkBreakdown/helpers/adfToText.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/react/reports/WorkBreakdown/helpers/adfToText.ts src/react/reports/WorkBreakdown/helpers/adfToText.test.ts src/react/reports/WorkBreakdown/helpers/index.ts
git commit -m "feat(workbreakdown): adfToText helper"
```

---

### Task 8: Thread `statusSummary` into the view model

**Files:**

- Modify: `src/react/reports/WorkBreakdown/types.ts` (`IssueOrRelease` + `Card`)
- Modify: `src/react/reports/WorkBreakdown/helpers/buildBoard.ts`
- Test: `src/react/reports/WorkBreakdown/helpers/buildBoard.statusSummary.test.ts` (create)

**Interfaces:**

- Consumes: `adfToText` (Task 7), `IssueOrRelease.statusSummary`.
- Produces: `Card.statusSummary?: { text: string }` — present only when the primary issue's status-summary text is non-empty.

- [ ] **Step 1: Write the failing test**

Create `buildBoard.statusSummary.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { buildBoard } from './buildBoard';
import type { IssueOrRelease } from '../types';

const primary = (over: Partial<IssueOrRelease>): IssueOrRelease => ({
  key: 'C-1',
  summary: '100 Stores',
  reportingHierarchy: { childKeys: [] },
  rollupStatuses: { rollup: { status: 'ontrack' } },
  ...over,
});

describe('buildBoard statusSummary', () => {
  it('populates card.statusSummary from a plain-string statusSummary', () => {
    const card = buildBoard([primary({ statusSummary: 'Ahead of plan' })], [], 'status').cards[0];
    expect(card.statusSummary?.text).toBe('Ahead of plan');
  });

  it('populates card.statusSummary from an ADF statusSummary', () => {
    const adf = {
      type: 'doc',
      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'Blocked on vendor' }] }],
    };
    const card = buildBoard([primary({ statusSummary: adf })], [], 'status').cards[0];
    expect(card.statusSummary?.text).toBe('Blocked on vendor');
  });

  it('leaves card.statusSummary undefined when there is no text', () => {
    expect(buildBoard([primary({})], [], 'status').cards[0].statusSummary).toBeUndefined();
    expect(buildBoard([primary({ statusSummary: '   ' })], [], 'status').cards[0].statusSummary).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/react/reports/WorkBreakdown/helpers/buildBoard.statusSummary.test.ts`
Expected: FAIL — `statusSummary` not on the type / `card.statusSummary` undefined.

- [ ] **Step 3: Extend the types**

In `types.ts`, add to `IssueOrRelease` (after `rollupStatuses`):

```ts
  reportingHierarchy?: { childKeys: string[] };
  rollupStatuses: RollupStatuses;
  /** Raw value of the configured "Status Summary" field (ADF object or plain string). */
  statusSummary?: string | Record<string, unknown> | null;
}
```

and add to `Card` (after `slip`):

```ts
  due?: Date | null;
  slip: DateSlip;
  /** Narrative status summary shown in place of the child status rows, when present. */
  statusSummary?: { text: string };
```

- [ ] **Step 4: Populate it in `buildBoard`**

In `buildBoard.ts`, add the import:

```ts
import { density } from './density';
import { adfToText } from './adfToText';
```

Inside the `cards` map, compute the summary and include it on the returned card:

```ts
const statusSummaryText = adfToText(primary.statusSummary);

return {
  key: primary.key,
  title: primary.summary,
  issue: primary,
  status: primary.rollupStatuses.rollup.status,
  due: primary.rollupStatuses.rollup.due ?? null,
  slip: dateSlip(primary.rollupStatuses.rollup),
  statusSummary: statusSummaryText ? { text: statusSummaryText } : undefined,
  headerColumns,
  statusRows,
  matrixRows,
};
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/react/reports/WorkBreakdown/helpers/buildBoard.statusSummary.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/react/reports/WorkBreakdown/types.ts src/react/reports/WorkBreakdown/helpers/buildBoard.ts src/react/reports/WorkBreakdown/helpers/buildBoard.statusSummary.test.ts
git commit -m "feat(workbreakdown): thread status summary into the card view model"
```

---

### Task 9: Render the status summary in the card

**Files:**

- Create: `src/react/reports/WorkBreakdown/components/StatusSummaryBody/StatusSummaryBody.tsx`
- Create: `src/react/reports/WorkBreakdown/components/StatusSummaryBody/index.ts`
- Modify: `src/react/reports/WorkBreakdown/components/index.ts` (export)
- Modify: `src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.tsx`
- Test: `src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.statusSummary.test.tsx` (create)
- Modify: `src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.stories.tsx` (add a story)

**Interfaces:**

- Consumes: `Card.statusSummary` (Task 8).
- Produces: `StatusSummaryBody` renders just the summary paragraph; `WorkBreakdownCard` renders it **above** the existing status/matrix body (which already renders `TargetDeliveryDate` itself) when `card.statusSummary` exists — nothing is removed.

- [ ] **Step 1: Write the failing test**

Create `WorkBreakdownCard.statusSummary.test.tsx`:

```tsx
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import type { Card } from '../../types';
import { WorkBreakdownCard } from './WorkBreakdownCard';

const baseCard: Card = {
  key: 'C-1',
  title: '100 Stores',
  issue: { key: 'C-1', summary: '100 Stores', rollupStatuses: { rollup: { status: 'ontrack' } } },
  status: 'ontrack',
  due: null,
  slip: { kind: 'none' },
  headerColumns: [],
  statusRows: [{ key: 'S-1', name: 'Digital menu board', issue: {} as never, status: 'ontrack' }],
  matrixRows: [],
};

describe('WorkBreakdownCard statusSummary', () => {
  test('renders the summary text ABOVE the child status rows (both shown) when a status summary is present', () => {
    render(
      <WorkBreakdownCard
        card={{ ...baseCard, statusSummary: { text: 'Ahead of plan' } }}
        mode="status"
        density="light"
      />,
    );
    expect(screen.getByText('Ahead of plan')).toBeTruthy();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
  });

  test('renders no summary block when no status summary is present', () => {
    render(<WorkBreakdownCard card={baseCard} mode="status" density="light" />);
    expect(screen.queryByText('Ahead of plan')).toBeNull();
    expect(screen.getByText('Digital menu board')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npm run test -- src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.statusSummary.test.tsx`
Expected: FAIL — summary text never rendered.

- [ ] **Step 3: Create `StatusSummaryBody`**

Create `StatusSummaryBody/StatusSummaryBody.tsx`:

```tsx
import React from 'react';
import type { Card } from '../../types';

export interface StatusSummaryBodyProps {
  card: Card;
  fontSize?: string;
}

/**
 * Narrative "Status Summary" text, rendered above the existing status/matrix body (which already
 * shows the "Target Delivery" date and child rows) — additive, not a replacement. MVP has no
 * option to hide the swatches; that's a fast follow (see requirements.md).
 */
export const StatusSummaryBody: React.FC<StatusSummaryBodyProps> = ({ card, fontSize = '' }) => (
  <p className={`m-0 whitespace-pre-line px-2.5 pt-1.5 pb-1 text-neutral-800 ${fontSize}`}>
    {card.statusSummary?.text}
  </p>
);
```

Create `StatusSummaryBody/index.ts`:

```ts
export { StatusSummaryBody } from './StatusSummaryBody';
export type { StatusSummaryBodyProps } from './StatusSummaryBody';
```

Add to `components/index.ts`:

```ts
export { StatusSummaryBody } from './StatusSummaryBody';
export type { StatusSummaryBodyProps } from './StatusSummaryBody';
```

- [ ] **Step 4: Render it above the existing body in `WorkBreakdownCard`**

In `WorkBreakdownCard.tsx`, add the import:

```ts
import { StatusMatrixBody } from '../StatusMatrixBody';
import { StatusSummaryBody } from '../StatusSummaryBody';
```

Insert it before the existing `mode === 'status'` conditional — do not replace that conditional:

```tsx
{
  card.statusSummary ? <StatusSummaryBody card={card} fontSize={bodyFontSize} /> : null;
}
{
  mode === 'status' ? (
    <StatusColumnBody card={card} size={size} fontSize={bodyFontSize} onIssueClick={onIssueClick} />
  ) : (
    <StatusMatrixBody card={card} size={size} fontSize={bodyFontSize} onIssueClick={onIssueClick} />
  );
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `npm run test -- src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.statusSummary.test.tsx`
Expected: PASS

- [ ] **Step 6: Add a Storybook story**

In `WorkBreakdownCard.stories.tsx`, add:

```tsx
/** A card with a status summary shown above its normal status rows. */
export const WithStatusSummary: StoryObj<Args> = {
  render: () => {
    const board = buildBoard(primaryIssues, allIssues, 'status');
    const card = {
      ...board.cards[0],
      statusSummary: { text: 'On track for Q3. QA starts Monday; vendor risk resolved.' },
    };
    return (
      <div className="flex" style={{ width: 280 }}>
        <WorkBreakdownCard card={card} mode="status" density="light" />
      </div>
    );
  },
};
```

- [ ] **Step 7: Run the full WorkBreakdown suite**

Run: `npm run test -- src/react/reports/WorkBreakdown`
Expected: PASS (no regressions in existing card/board tests).

- [ ] **Step 8: Commit**

```bash
git add src/react/reports/WorkBreakdown/components/StatusSummaryBody src/react/reports/WorkBreakdown/components/index.ts src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.tsx src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.statusSummary.test.tsx src/react/reports/WorkBreakdown/components/WorkBreakdownCard/WorkBreakdownCard.stories.tsx
git commit -m "feat(workbreakdown): render status summary in the card"
```

---

## Phase D — End-to-end verification

### Task 10: Verify the full path and guard against regressions

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole project**

Run: `npm run typecheck`
Expected: no errors. (Watch for `NormalizedIssue` literals in other tests needing `statusSummary: null`.)

- [ ] **Step 2: Run the affected unit suites**

Run: `npm run test -- src/jira/normalized src/react/reports/WorkBreakdown "src/react/SettingsSidebar/components/TeamConfiguration"`
Expected: PASS

- [ ] **Step 3: Manual smoke test (dev)**

Run: `npm run dev`. Then:

1. Load a report with initiatives that have a paragraph custom field populated.
2. Settings → Teams → set **Status summary field** to that field.
3. Confirm the secondary-report cards now show the field's text **above** the existing child status rows/matrix (both visible).
4. Set the field back to **Don't show a status summary** → confirm the summary text disappears and cards look exactly as before.
5. Pick an initiative with an empty field → confirm that card shows no summary block and looks exactly as before.

- [ ] **Step 4: Final commit (if any fixes were needed)**

```bash
git add -A
git commit -m "test: verify status summary end-to-end"
```

---

## Self-Review

- **Spec coverage:** requirements.md "Read" path → Tasks 1–2, 7–9. "User picks which field … persists" → Tasks 3–6 (persisted via existing Team Configuration storage, per-team inheritance inherited for free). "ADF converted to readable text" → Task 7. "Empty field falls back to swatches" → Tasks 8–9. Write path (phase 2 in requirements) is intentionally **out of scope** here — see [user-typed-summary](../user-typed-summary/requirements.md).
- **Non-goals (explicit):** no new route param; no new fetch call; no write-back; no separate display toggle/mode.
- **Type consistency:** `statusSummaryField` (config) ↔ `getStatusSummary` (normalize) ↔ `statusSummary` (NormalizedIssue / IssueOrRelease) ↔ `Card.statusSummary.text` (view model) ↔ `StatusSummaryBody`. Sentinel `'status-summary-not-used'` handled in the Task 2 extractor and Task 4 resolver, and seeded in Task 5.
- **Ordering note:** Tasks 2 and 3 are mutually referencing at the type level (extractor reads `config.statusSummaryField`). If a subagent does Task 2 before Task 3, expect a single type error on `statusSummaryField`; land Task 3 to clear it, or do Task 3 first.

## Open questions (resolve during execution)

- Should the summary display be capped (e.g. 3–4 lines with a "more" affordance) for dense boards? MVP renders full text with `whitespace-pre-line`; clamping is a fast follow (see Idea 2 requirements).
- Do we want provenance (author/updated) on the card? Not available from a plain field read without extra history calls — deferred.
