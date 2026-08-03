/**
 * One definition of "the same question", shared by the two layers of spec/016 optimization 1
 * (`spec/016-report-of-reports/005-optimize/001-request-dedupe/plan.md`, Phase 0).
 *
 * - {@link queryKeyOf} groups a document's embedded reports that ask Jira the same thing, so their
 *   requested field lists can be widened to a common union (Phase 1).
 * - {@link rawIssuesCacheKey} keys the `getRawIssues` singleflight cache (Phase 2).
 *
 * They live in one module because if the two definitions ever disagree, Phase 1 widens every request
 * and Phase 2 dedupes nothing — cost with no benefit, and silent.
 */
import { canonicalFieldIdSet, type FieldMaps } from '../canjs/routing/route-data/requested-fields';
import { CORE_FIELDS } from './core-fields';

export type { FieldMaps };

/** The inputs that decide WHICH work items come back — everything but the column projection. */
export interface QueryKeyInput {
  jql?: string | null;
  childJQL?: string | null;
  loadChildren?: boolean | null;
}

export interface CacheKeyInput extends QueryKeyInput {
  isLoggedIn?: boolean | null;
  fields?: string[] | null;
}

/**
 * Identifies the *question* a report asks Jira: which work items it wants, ignoring which fields of
 * them it wants.
 *
 * `isLoggedIn` is deliberately excluded. It is global to the page, so it cannot distinguish two
 * children of one document, and the document-layer grouping has no use for it.
 */
export function queryKeyOf({ jql, childJQL, loadChildren }: QueryKeyInput): string {
  return JSON.stringify([jql ?? '', childJQL ?? '', loadChildren ? 1 : 0]);
}

/**
 * The `getRawIssues` cache key: the question, plus the canonical set of field ids that will actually
 * be sent.
 *
 * The invariant is that **the key is a function of what will actually be sent, computed by the same
 * rule the sender uses**. Both senders resolve identifiers with `nameMap[f] || f` (`jira.ts` for the
 * flat path, `makeDeepChildrenLoaderUsingNamedFields.ts` for the deep one), which is exactly
 * `toFieldId`. Three things follow, and all three buy dedupe hits:
 *
 * - **Order is normalized away.** `allFieldsToRequest` is a `[...new Set(...)]` union whose tail is
 *   ordered by the report's *column* order — the thing users drag around — so two Tables over one JQL
 *   with the same columns in a different order produce different arrays for the same set.
 * - **Core is absorbed.** `getRawIssues` folds `CORE_FIELDS` in before sending, so a Table whose only
 *   column is Status (`['Status']`) and a Gantt over the same JQL (`[]`) send the same thing.
 * - **Names and ids collapse.** `Status` and `status` are one field.
 *
 * Before the field maps load, `toFieldId` passes identifiers through unchanged, so an early caller may
 * key on `'Status'` where a later one keys on `'status'`. That can only *miss* a dedupe, never create
 * a false one.
 *
 * `jiraHelpers` is not in the string: the cache is a `WeakMap` keyed by it, so a different site
 * physically cannot reach another site's entries.
 */
export function rawIssuesCacheKey(
  { isLoggedIn, loadChildren, jql, childJQL, fields }: CacheKeyInput,
  maps?: FieldMaps,
): string {
  const canonicalFields = [...canonicalFieldIdSet([...(fields ?? []), ...CORE_FIELDS], maps)].sort();

  return JSON.stringify([
    isLoggedIn === false ? 'sample' : 'jira',
    queryKeyOf({ jql, childJQL, loadChildren }),
    canonicalFields,
  ]);
}
