# 015 — Field selection: quick fix for duplicate field names

Let a user pick **which** of two identically-named Jira fields (e.g. two "Start date"
fields) a report concept uses, when the account has field-name collisions. Today the
selection UI shows two indistinguishable options and the pipeline silently locks onto one,
so the user can never switch.

This is the **quick / surgical** fix. It confines field-**id** handling to the exact broken
case (duplicate names) and leaves the app's pervasive field-**name** keying untouched. The
full "field-ids everywhere" migration is a separate, larger effort (see Out of scope).

## Context

Field selection is 100% name-based. Two things collapse a duplicated name to a single field:

1. **The dropdown** builds options as `{ value: name, label: name }`
   (`ConfigureTeamsForm.tsx:40`, `AllTeamsDefaultsForm.tsx:28`) — the field `id` is thrown
   away. Two "Start date" fields → two options with the **identical value** `"Start date"`.
   `Select.tsx:39` matches the current value by `option.value === field.value`, so the user
   can never express "the _other_ one," and both options look the same.

2. **The fetch/normalize pipeline** collapses again downstream:
   - `nameMap["Start date"]` is pinned to one id by `fieldPriorityOrder` (`fields.ts:53-56`),
     so only one field is ever requested from Jira.
   - `mapIdsToNames` (`map-ids-to-names.ts:8`) rewrites every response key id → name, so both
     fields (if both were fetched) would land in the single `issue.fields["Start date"]`
     slot — last one wins.

The normalizer reads `issue.fields[<configured value>]` (`Teams/shared/normalize.ts`
`getStartDate` etc.), and the config persists a plain name string
(`Configuration.startDateField: string | null`, stored under `all-team-data`).

### The load-bearing constraint

`issue.fields["Start date"]` is a single slot. As long as the config value **and** the
key we read are the field **name**, two same-named fields can never be told apart. The only
identifier that disambiguates is the field **id**. So the fix must introduce the id as the
selection identifier for the colliding case — and make that id survive `mapIdsToNames`.

## Decisions (recommended defaults)

- **Ids only for duplicated names.** Fields whose name is unique keep storing their **name**
  exactly as today — no migration, existing configs keep matching in the dropdown. Only
  fields whose name collides switch to an **id** value + a disambiguated label. Smallest
  blast radius; the only behavior change is in the case that is already broken.
- **Preserve id keys only for ambiguous fields in `mapIdsToNames`.** Keep the name key for
  everything (so defaults and existing name-based configs keep working), and _additionally_
  keep the raw `issue.fields[<id>]` entry for fields whose name collides — so the two
  duplicates occupy distinct, non-colliding slots. Non-duplicated fields are untouched.
- **No config migration.** Existing configs that referenced a duplicated name (e.g.
  `"Start date"`) will simply show no selection in the dropdown until the user re-picks one
  of the now-distinct options. That is acceptable and arguably correct — that config was
  ambiguous/broken already, and the report keeps rendering the old priority-order pick until
  they choose. Unique-named configs are unaffected.

## Changes

### 1. `src/react/.../Teams/shared/selectable-fields.ts` (new) — disambiguating option builder

Pure helper the two forms share. Unique names stay name-valued; duplicated names become
id-valued with a disambiguated label.

```ts
import type { IssueFields } from '../services/team-configuration';

export interface SelectableField {
  value: string;
  label: string;
}

/**
 * Build the `<Select>` options for the Jira fields.
 *
 * A field whose display name is unique keeps `value: name` (unchanged, name-based — no
 * migration for existing configs). A field whose display name is shared by another field
 * uses `value: id` and a disambiguated label so the user can tell the two apart and pick a
 * specific one. See spec/015-field-selection.
 */
export const buildSelectableFields = (jiraFields: IssueFields): SelectableField[] => {
  const nameCounts = new Map<string, number>();
  for (const { name } of jiraFields) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return jiraFields.map(({ name, id }) =>
    (nameCounts.get(name) ?? 0) > 1 ? { value: id, label: `${name} (${id})` } : { value: name, label: name },
  );
};
```

### 2. `src/jira-oidc-helpers/fields.ts` — compute `ambiguousFieldIds`

Extract the field-map transform into a pure, testable `deriveFieldMaps(fields)` and, while
building `idToFields` (which already groups fields by name), collect the ids of every field
whose name is shared by more than one field:

```ts
export function deriveFieldMaps(fields: Array<{ name: string; id: string; scope?: string }>) {
  const nameMap: Record<string, string> = {};
  const idMap: Record<string, string> = {};
  const idToFields: Record<string, Array<{ name: string; id: string; scope?: string }>> = {};
  const ambiguousFieldIds = new Set<string>();

  fields.forEach((f) => {
    idMap[f.id] = f.name;
    (idToFields[f.name] ??= []).push(f);
  });

  for (const fieldName in idToFields) {
    idToFields[fieldName].sort(fieldPriorityOrder);
    nameMap[fieldName] = idToFields[fieldName][0].id;
    if (idToFields[fieldName].length > 1) {
      for (const f of idToFields[fieldName]) ambiguousFieldIds.add(f.id);
    }
  }

  return { nameMap, idMap, ambiguousFieldIds };
}
```

`makeFieldsRequest` returns `{ list: fields, ...deriveFieldMaps(fields) }`. Add
`ambiguousFieldIds: Set<string>` to `FieldsData` (`src/jira-oidc-helpers/types.ts:32-37`).

### 3. `src/utils/object/map-ids-to-names.ts` — keep id keys for ambiguous fields

```ts
type Fields = {
  idMap: Record<string, string>;
  ambiguousFieldIds?: Set<string>; // ids whose display name is shared by >1 field
};

export default function mapIdsToNames(obj: { [key: string]: any }, fields: Fields) {
  const mapped: { [key: string]: any } = {};
  for (const prop in obj) {
    // Keep the raw id key for name-colliding fields so two identically-named fields don't
    // overwrite each other under the single shared name key. See spec/015-field-selection.
    if (fields.ambiguousFieldIds?.has(prop)) {
      mapped[prop] = obj[prop];
    }
    mapped[fields.idMap[prop] || prop] = obj[prop];
  }
  return mapped;
}
```

The `ambiguousFieldIds` set is optional, so any other caller/test passing a bare `{ idMap }`
still compiles and behaves exactly as before.

### 4. `src/react/.../team-configuration/fetcher.ts` — match saved value by id OR name

`fixAnyNonExistingFields` currently deletes a saved config field when no field's **name**
matches it (`fetcher.ts:83-85`). An id-valued config (the duplicate case) would be wrongly
deleted. Match on either:

```ts
const matched = jiraIssues.find((issue) => issue.id === field || issue.name === field);
```

### 5. `ConfigureTeamsForm.tsx` + `AllTeamsDefaultsForm.tsx` — use the helper

Replace the inline `jiraFields.map(({ name }) => ({ value: name, label: name }))` (line 40 /
line 28 respectively) with `buildSelectableFields(jiraFields)`. No other form changes; the
`confidence-not-used` / `status-summary-not-used` sentinel groups are unaffected.

### No change needed

- **Normalizer read** (`Teams/shared/normalize.ts` getters): already reads
  `issue.fields[<configured value>]`. When the value is an ambiguous field's id, that key now
  exists (Change 3); when it's a unique name, it works as before.
- **Request path** (`jira.ts:79-81`): an id that isn't in `nameMap` is passed through to the
  Jira API as-is (already true — `f in fields.nameMap ? nameMap[f] : f`). Jira's `fields`
  search param accepts field ids.
- **Defaults** (`jira/normalized/defaults.ts`): keep reading hard-coded names; the name keys
  are still present.

## Backward compatibility

- Unique-named fields: identical behavior, byte-for-byte config, no migration.
- Duplicated-name configs saved before this change: the dropdown shows no current selection
  (its two options are now id-valued) until the user picks one; the report keeps rendering
  the previous priority-order pick in the meantime. No data is lost or rewritten
  automatically (`fixAnyNonExistingFields` keeps the old name because a field with that name
  still exists).

## Risks / caveats

- **Extra keys on `issue.fields` for ambiguous fields only.** Anything that enumerates
  `Object.keys(issue.fields)` (e.g. CSV export) would see the raw id key _in addition to_ the
  name key for a colliding field. This is scoped to accounts that actually have duplicate
  names, and only to the colliding fields. Verify CSV export on such an account.
- **Label uses the raw id** (`Start date (customfield_10015)`). Functional and unambiguous;
  a friendlier label (schema type / scope) is a possible follow-up, not required.
- **Two teams can now use two different same-named fields at once.** Because the id keys
  don't collide, this actually works — a nice side effect, but worth an explicit test.

## Verification

- `npm run typecheck` (tsc) and `npm test` (vitest) pass.
- New unit tests (TDD): `buildSelectableFields` (unique vs duplicate), `deriveFieldMaps`
  (`ambiguousFieldIds` contents), `mapIdsToNames` (ambiguous id key preserved, non-ambiguous
  unchanged), `fixAnyNonExistingFields` (id-valued entry not deleted).
- Storybook (credential-free): render a config form with a fixture containing two "Start
  date" fields; confirm two distinct, labeled options appear and either can be selected.
- End-to-end (needs Jira creds — use `launch-dev` or ask the user): on the affected account,
  open Team configuration, confirm both "Start date" fields are selectable and switching
  between them changes which field drives the report.

## Out of scope (→ separate "right fix" plan)

- Migrating the whole app from field names to field ids (config, transport, FlowMetrics'
  lowercase-id scheme, `rollback.ts`, CSV column contract, and the URL/saved-report `fields`
  param). Measured at ~28–32 files; contained by the normalization layer but contract-risky.
  This quick fix is deliberately additive so that migration can proceed later without undoing
  anything here.
- Automatic migration of old name-based configs to ids.
- Friendlier duplicate-field labels (schema type / scope instead of raw id).
