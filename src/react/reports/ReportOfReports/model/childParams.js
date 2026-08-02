import { CHILD_PARAMS, serializeChildParam } from './ChildReportConfig.js';

/**
 * Parse one setting out of a child's saved `queryParams`, by exactly the rule `childParam` uses when
 * the config resolves it: `parse(raw ?? defaultRaw)`.
 */
function parseChildParam(params, key) {
  const spec = CHILD_PARAMS[key];
  const raw = params.get(key);
  return spec.parse(raw == null ? spec.defaultRaw : raw);
}

/**
 * What query a saved report runs, and which columns it shows — read straight out of its saved
 * `queryParams` with no `ChildReportConfig` and no CanJS.
 *
 * This is how the *document* can group its children by the question they ask Jira before it renders
 * any of them (spec/016-report-of-reports/005-optimize/001-request-dedupe, Phase 1). It shares
 * `CHILD_PARAMS` with `ChildReportConfig` rather than re-implementing the parse, because a document
 * that parsed a child's query differently from how the child parses it would compute the wrong groups
 * — and nothing would throw, and nothing would render wrong. `childParams.test.js` asserts the two
 * agree.
 *
 * @param {string} queryParams the child's saved query string
 * @returns {{ jql: string, childJQL: string, loadChildren: boolean, tableColumns: Array<{sourceId: string}> }}
 */
export function parseChildQuery(queryParams) {
  const params = new URLSearchParams(queryParams ?? '');

  return {
    jql: parseChildParam(params, 'jql'),
    childJQL: parseChildParam(params, 'childJQL'),
    loadChildren: parseChildParam(params, 'loadChildren'),
    tableColumns: parseChildParam(params, 'tableColumns'),
  };
}

/**
 * A child's **effective** configuration: its saved `queryParams` with its node's `overrides` laid
 * over the top. Both are query strings, so the result is one too — which is what lets everything
 * downstream (`ChildReportConfig`, {@link parseChildQuery}, the request-dedupe grouping) keep the
 * single parser it already has, with no second input path to disagree about.
 *
 * Returns the saved string *by identity* when there is nothing to merge. That matters: it is a
 * `useMemo` dependency in `ChildReport`, and re-encoding it through `URLSearchParams` would produce
 * an equal-but-different string on some inputs and rebuild every child's config.
 *
 * See spec/016-report-of-reports/006-url-state Phase 2.
 */
export function mergeChildQuery(queryParams, overrides) {
  if (!overrides) {
    return queryParams ?? '';
  }

  const merged = new URLSearchParams(queryParams ?? '');

  for (const [key, value] of new URLSearchParams(overrides)) {
    merged.set(key, value);
  }

  return merged.toString();
}

/**
 * The canonical query-string form of a child's *saved* value for `key` — what its own
 * `queryParams` would serialize back to if the child set that value itself.
 *
 * Canonical, rather than the raw stored substring, because the two need not agree: parsing
 * `timingCalculations` into an object and re-emitting it reorders the phrases, and a `tableColumns`
 * JSON blob can differ in whitespace or key order while meaning exactly the same thing. Comparing
 * against the raw form would then declare a change where there is none — an override that never
 * clears and a document that is permanently dirty.
 */
function canonicalSavedValue(queryParams, key) {
  const spec = CHILD_PARAMS[key];
  const raw = new URLSearchParams(queryParams ?? '').get(key);

  if (!spec) {
    return raw == null ? undefined : raw;
  }

  try {
    return serializeChildParam(key, spec.parse(raw == null ? spec.defaultRaw : raw));
  } catch {
    return raw == null ? spec.defaultRaw : raw;
  }
}

/**
 * What to record on a child's node for `key`, given the value the report just wrote: `serialized`
 * when it differs from what that report has saved, `undefined` when it doesn't.
 *
 * The `undefined` case is the whole point — it is what makes a sort toggled there and back leave no
 * trace, exactly as `updateUrlParam` deleting a param that matches the saved report does for every
 * other setting.
 */
export function childOverrideValue(queryParams, key, serialized) {
  return canonicalSavedValue(queryParams, key) === serialized ? undefined : serialized;
}
