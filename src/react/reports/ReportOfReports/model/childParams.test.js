import { describe, expect, it } from 'vitest';

import { ObservableObject, value } from '../../../../can';
import { ChildReportConfig } from './ChildReportConfig';
import { childOverrideValue, mergeChildQuery, parseChildQuery } from './childParams';

class FakeParent extends ObservableObject {
  static props = {
    jiraHelpers: { default: null },
    isLoggedInObservable: { default: null },
    fieldsToRequest: {
      get default() {
        return [];
      },
    },
  };
}

const configFor = (queryParams) => {
  const parent = new FakeParent();
  parent.isLoggedInObservable = value.with(true);
  return new ChildReportConfig({ queryParams, parent });
};

/**
 * The anti-drift assertion this module exists for.
 *
 * The document groups its children by `parseChildQuery(report.queryParams)` while each child runs its
 * fetch off its own `ChildReportConfig`. If the two ever disagreed, the groups would be computed off
 * values no request uses — request-dedupe would silently split, with nothing thrown and nothing
 * rendered wrong. Sharing `CHILD_PARAMS` makes that structurally hard; this makes it executable.
 */
describe('parseChildQuery agrees with ChildReportConfig', () => {
  const cases = {
    'an empty query': '',
    'a plain jql': 'jql=project%20%3D%20ORDER',
    'jql + childJQL': 'jql=project%20%3D%20ORDER&childJQL=type%20%3D%20Bug',
    'loadChildren on': 'jql=project%20%3D%20ORDER&loadChildren=true',
    'loadChildren off, explicitly': 'jql=project%20%3D%20ORDER&loadChildren=false',
    'loadChildren valueless': 'jql=project%20%3D%20ORDER&loadChildren',
    'table columns': 'tableColumns=' + encodeURIComponent(JSON.stringify([{ sourceId: 'field:customfield_1' }])),
    'unrelated params only': 'primaryReportType=table&roundTo=week',
    // A malformed param must not take down a document that renders several reports — the child
    // swallows it, so the document has to swallow it identically.
    'malformed tableColumns': 'tableColumns=' + encodeURIComponent('{not json'),
  };

  it.each(Object.entries(cases))('%s', (_label, queryParams) => {
    const config = configFor(queryParams);
    const parsed = parseChildQuery(queryParams);

    expect(parsed).toEqual({
      jql: config.jql,
      childJQL: config.childJQL,
      loadChildren: config.loadChildren,
      tableColumns: config.tableColumns,
    });
  });

  it('returns the same non-empty tableColumns default the child gets', () => {
    // A non-empty default matters: every child parses to at least one column, so if it required a
    // field it would widen every group. `identity:treeSummary` requires none — see childQueryGroups.
    expect(parseChildQuery('').tableColumns).toEqual([{ sourceId: 'identity:treeSummary' }]);
  });

  it('tolerates a nullish query string', () => {
    expect(parseChildQuery(undefined).jql).toBe('');
  });
});

/**
 * spec/016-report-of-reports/006-url-state Phase 2. A child's effective configuration is its saved
 * `queryParams` with its node's `overrides` laid over the top — one query string, so nothing
 * downstream needs a second parser.
 */
describe('mergeChildQuery', () => {
  it('lays the overrides over the saved params', () => {
    const merged = mergeChildQuery('jql=project%3DA&tableSortDir=tree', 'tableSortDir=desc');

    expect(new URLSearchParams(merged).get('jql')).toBe('project=A');
    expect(new URLSearchParams(merged).get('tableSortDir')).toBe('desc');
  });

  it('adds a key the saved params never had', () => {
    expect(new URLSearchParams(mergeChildQuery('jql=x', 'tableSortColumn=summary')).get('tableSortColumn')).toBe(
      'summary',
    );
  });

  // Identity, not just equality: this is a `useMemo` dependency in ChildReport, and a re-encoded
  // string would rebuild every child's config — and with it every child's fetch.
  it('returns the saved string itself when there is nothing to merge', () => {
    const saved = 'jql=project%3DA&loadChildren';

    expect(mergeChildQuery(saved, undefined)).toBe(saved);
    expect(mergeChildQuery(saved, '')).toBe(saved);
  });

  it('tolerates a nullish query string', () => {
    expect(mergeChildQuery(undefined, undefined)).toBe('');
    expect(new URLSearchParams(mergeChildQuery(undefined, 'tableSortDir=desc')).get('tableSortDir')).toBe('desc');
  });

  // The child parses the merged string with the same parser the document groups on, so an override
  // that changes the query moves that child between request-dedupe groups.
  it('is what parseChildQuery then sees', () => {
    expect(parseChildQuery(mergeChildQuery('jql=project%3DA', 'jql=project%3DB')).jql).toBe('project=B');
  });
});

describe('childOverrideValue', () => {
  it('records a value that differs from the saved one', () => {
    expect(childOverrideValue('tableSortDir=tree', 'tableSortDir', 'desc')).toBe('desc');
  });

  it('records nothing when the value is what the report has saved', () => {
    expect(childOverrideValue('tableSortDir=desc', 'tableSortDir', 'desc')).toBeUndefined();
  });

  // The saved report need not mention the key at all; the child's default is what it renders, so
  // that is what "unchanged" means. Without this, the first sort back to the default would pin an
  // override forever and leave the document permanently dirty.
  it('compares against the default when the report never saved the key', () => {
    expect(childOverrideValue('jql=project%3DA', 'tableSortDir', 'tree')).toBeUndefined();
    expect(childOverrideValue('jql=project%3DA', 'tableSortDir', 'desc')).toBe('desc');
  });

  // Canonicalized on both sides: `{Epic: …, Story: …}` re-emits in insertion order, which needn't
  // match the order the saved string happened to use.
  it('compares canonicalized values, not raw substrings', () => {
    const saved = 'tableFilters=' + encodeURIComponent('{ "a": 1 }');

    expect(childOverrideValue(saved, 'tableFilters', JSON.stringify({ a: 1 }))).toBeUndefined();
  });

  it('carries an absent value through as "remove the key"', () => {
    expect(childOverrideValue('timeInStatusReorder=%7B%22Done%22%3A1%7D', 'timeInStatusReorder', undefined)).toBe(
      undefined,
    );
  });
});
