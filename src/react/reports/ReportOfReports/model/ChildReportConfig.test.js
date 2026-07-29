import { ObservableObject, value } from '../../../../can';
import { RouteData } from '../../../../canjs/routing/route-data/route-data';
import {
  ChildReportConfig,
  CHILD_PARAM_KEYS,
  AD_HOC_CHILD_PARAM_KEYS,
  SHELL_ONLY_PARAM_KEYS,
} from './ChildReportConfig';

/**
 * A stand-in for the shared `routeData` singleton. `ChildReportConfig` reads only the genuinely
 * global properties off it — Jira metadata and team configuration, which are the same for every
 * report on the page. See spec/016-report-of-reports Phase 2.
 */
class FakeParent extends ObservableObject {
  static props = {
    jiraHelpers: { default: null },
    isLoggedInObservable: { default: null },
    licensingPromise: { default: null },
    normalizeOptions: { default: null },
    simplifiedIssueHierarchy: {
      get default() {
        return [];
      },
    },
    fieldsToRequest: {
      get default() {
        return [];
      },
    },
    fieldMaps: { default: undefined },
  };
}

const makeParent = (overrides = {}) => {
  const parent = new FakeParent();

  parent.isLoggedInObservable = value.with(true);
  Object.assign(parent, overrides);

  return parent;
};

const childConfig = (queryParams, parentOverrides = {}) =>
  new ChildReportConfig({ queryParams, parent: makeParent(parentOverrides) });

/**
 * A Jira issue in the named-fields shape the fetch returns, minimal but real enough to survive
 * `normalizeIssue` → `deriveIssue`. Deliberately undated: what these tests check is that the fetch
 * chain resolves at all, and a fixed pair of dates would drift into whichever `work-timing` branch
 * the current date puts it in.
 */
const jiraIssue = (key) => ({
  id: key,
  key,
  fields: {
    Summary: `summary for ${key}`,
    'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
    Created: '2023-02-03T10:58:38.994-0600',
    Status: { id: '1', name: 'Done', statusCategory: { name: 'Done' } },
    'Project key': 'ONE',
    Labels: [],
    'Fix versions': [],
    Parent: null,
    Team: null,
    Sprint: null,
    Rank: '0|hzzzzn:',
  },
});

describe('ChildReportConfig', () => {
  describe('per-child parameters', () => {
    it('parses strings from its own queryParams', () => {
      const config = childConfig('jql=project%20%3D%20ABC&childJQL=type%20%3D%20Story');

      expect(config.jql).toBe('project = ABC');
      expect(config.childJQL).toBe('type = Story');
    });

    // The headline requirement: two children on one page must not share a config. This is exactly
    // what the shell's single routeData-bound props bag would break.
    it('gives two children built from different strings different settings', () => {
      const first = childConfig('jql=project%20%3D%20ONE&primaryReportType=start-due');
      const second = childConfig('jql=project%20%3D%20TWO&primaryReportType=due');

      expect(first.jql).toBe('project = ONE');
      expect(second.jql).toBe('project = TWO');
      expect(first.primaryReportType).toBe('start-due');
      expect(second.primaryReportType).toBe('due');
    });

    it('parses booleans the way the URL layer does', () => {
      expect(childConfig('loadChildren=true').loadChildren).toBe(true);
      expect(childConfig('loadChildren=').loadChildren).toBe(true);
      expect(childConfig('loadChildren=false').loadChildren).toBe(false);
      expect(childConfig('').loadChildren).toBe(false);
      expect(childConfig('hideUnknownInitiatives=true').hideUnknownInitiatives).toBe(true);
    });

    it('parses comma-separated lists', () => {
      expect(childConfig('statusesToExclude=Done,Rejected').statusesToExclude).toEqual(['Done', 'Rejected']);
      expect(childConfig('').statusesToExclude).toEqual([]);
      expect(childConfig('').aggregators).toEqual(['issuesList']);
      expect(childConfig('aggregators=storyPoints').aggregators).toEqual(['storyPoints']);
    });

    it('parses JSON params', () => {
      const rows = [{ id: 'r1', field: 'jiraStatus', operator: 'is', value: ['Done'] }];

      expect(childConfig('filterRows=' + encodeURIComponent(JSON.stringify(rows))).filterRows).toEqual(rows);
      expect(childConfig('').tableColumns).toEqual([{ sourceId: 'identity:treeSummary' }]);
      expect(childConfig('').tableFilters).toEqual({});
    });

    it('falls back to the default rather than throwing on malformed JSON', () => {
      expect(childConfig('filterRows=not-json').filterRows).toEqual([]);
    });

    it('parses numbers', () => {
      expect(childConfig('flowMetricsCycleTimeRange=90').flowMetricsCycleTimeRange).toBe(90);
      expect(childConfig('').flowMetricsCycleTimeRange).toBe(30);
      expect(childConfig('').timeInStatusDateRange).toBe(30);
    });

    it('validates constrained params the way route-data does', () => {
      expect(childConfig('roundTo=month').roundTo).toBe('month');
      expect(childConfig('roundTo=fortnight').roundTo).toBe('day');
      expect(childConfig('primaryReportType=due').primaryReportType).toBe('due');
      expect(childConfig('primaryReportType=nonsense').primaryReportType).toBe('start-due');
    });

    it('parses timingCalculations into its hierarchy-type map', () => {
      expect(childConfig('timingCalculations=Epic:childrenOnly,Story:widestRange').timingCalculations).toEqual({
        Epic: 'childrenOnly',
        Story: 'widestRange',
      });
      expect(childConfig('').timingCalculations).toEqual({});
    });

    it('applies report-specific defaults', () => {
      const config = childConfig('');

      expect(config.rowGroup).toBe('projectKey');
      expect(config.colGroup).toBe('dueInMonth');
      expect(config.tableSortColumn).toBe('identity:treeSummary');
      expect(config.tableFieldAxis).toBe('rows');
      expect(config.scatterDateRangeStart).toBe('');
    });

    it('ignores the parent page URL entirely', () => {
      const original = window.location.search;

      window.history.replaceState({}, '', '?jql=LEAKED&primaryReportType=table2');

      try {
        expect(childConfig('jql=MINE').jql).toBe('MINE');
        expect(childConfig('').jql).toBe('');
        expect(childConfig('').primaryReportType).toBe('start-due');
      } finally {
        window.history.replaceState({}, '', original || '/');
      }
    });
  });

  describe('shared global properties', () => {
    it('reads Jira and team metadata off the parent rather than refetching it', () => {
      const jiraHelpers = { marker: 'jira' };
      const normalizeOptions = { marker: 'normalize' };
      const simplifiedIssueHierarchy = [{ name: 'Epic', hierarchyLevel: 1 }];
      const parent = makeParent({ jiraHelpers, normalizeOptions, simplifiedIssueHierarchy });

      const config = new ChildReportConfig({ queryParams: 'jql=X', parent });

      expect(config.jiraHelpers).toBe(jiraHelpers);
      expect(config.normalizeOptions).toBe(normalizeOptions);
      expect(config.simplifiedIssueHierarchy).toBe(simplifiedIssueHierarchy);
      expect(config.isLoggedInObservable).toBe(parent.isLoggedInObservable);
    });
  });

  describe('hybrid properties', () => {
    const hierarchy = [
      { name: 'Epic', type: 'Epic', hierarchyLevel: 1 },
      { name: 'Story', type: 'Story', hierarchyLevel: 0 },
    ];

    // issueTimingCalculations combines the GLOBAL hierarchy with the PER-CHILD timingCalculations.
    // Sharing it wholesale would silently give every child the first child's hierarchy slicing.
    it('recomputes issueTimingCalculations from the shared hierarchy and its own timingCalculations', () => {
      const first = childConfig('timingCalculations=Epic:childrenOnly', { simplifiedIssueHierarchy: hierarchy });
      const second = childConfig('timingCalculations=Epic:widestRange', { simplifiedIssueHierarchy: hierarchy });

      const calculationFor = (config, type) =>
        config.issueTimingCalculations.find((level) => level.type === type)?.calculation;

      expect(calculationFor(first, 'Epic')).toBe('childrenOnly');
      expect(calculationFor(second, 'Epic')).toBe('widestRange');
    });

    it('returns no timing levels until the shared hierarchy has loaded', () => {
      expect(childConfig('timingCalculations=Epic:childrenOnly').issueTimingCalculations).toEqual([]);
    });

    // allFieldsToRequest is the SECOND hybrid: the base field list is global (team config), but the
    // `fields` param and the Table report's shown columns are per-child. A child that shared the
    // parent's list would silently fail to load the fields its own report needs.
    it('unions the shared base fields with its own requested fields', () => {
      const config = childConfig('fields=Summary,Labels', { fieldsToRequest: ['Status', 'Parent'] });

      expect(config.allFieldsToRequest).toEqual(expect.arrayContaining(['Status', 'Parent', 'Summary', 'Labels']));
    });

    it('includes the fields its own table columns require', () => {
      const columns = JSON.stringify([{ sourceId: 'field:Story points' }]);
      const config = childConfig('tableColumns=' + encodeURIComponent(columns), { fieldsToRequest: ['Status'] });

      expect(config.allFieldsToRequest).toEqual(expect.arrayContaining(['Status', 'Story points']));
    });
  });

  describe('effectiveFilterRows', () => {
    it('prefers explicit filter rows', () => {
      const rows = [{ id: 'r1', field: 'jiraStatus', operator: 'is', value: ['Done'] }];
      const config = childConfig('filterRows=' + encodeURIComponent(JSON.stringify(rows)));

      expect(config.effectiveFilterRows).toEqual(rows);
    });

    // Without this, an older saved report embedded as a child silently loses its status filter.
    it('migrates the legacy statusesToShow param', () => {
      expect(childConfig('statusesToShow=Done,In%20Progress').effectiveFilterRows).toEqual([
        { id: 'legacy-statuses-to-show', field: 'jiraStatus', operator: 'is', value: ['Done', 'In Progress'] },
      ]);
    });

    it('migrates the legacy statusesToRemove param', () => {
      expect(childConfig('statusesToRemove=Done').effectiveFilterRows).toEqual([
        { id: 'legacy-statuses-to-remove', field: 'jiraStatus', operator: 'is not', value: ['Done'] },
      ]);
    });

    it('is empty when nothing is configured', () => {
      expect(childConfig('').effectiveFilterRows).toEqual([]);
    });
  });

  describe('its own fetch', () => {
    it('requests its own JQL, so two children load different issues', async () => {
      const requested = [];
      const jiraHelpers = {
        fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: (request) => {
          requested.push(request.jql);
          return Promise.resolve([]);
        },
      };
      const parent = makeParent({ jiraHelpers, fieldsToRequest: ['Status'] });

      const first = new ChildReportConfig({ queryParams: 'jql=project%20%3D%20ONE', parent });
      const second = new ChildReportConfig({ queryParams: 'jql=project%20%3D%20TWO', parent });

      // Reading the request data is what kicks the CanJS pipeline off.
      first.rawIssuesRequestData;
      second.rawIssuesRequestData;

      expect(requested).toEqual(['project = ONE', 'project = TWO']);
    });

    /**
     * The test above proves two children *request* different issues. This one proves the rest of the
     * chain actually produces any: raw → `derivedIssuesRequestData` → `derivedIssues`, through the
     * real `state-helpers` functions and the real normalize/derive pipeline.
     *
     * Worth its own test because the failure here is silent. `derivedIssuesRequestData` returns a
     * never-settling promise when `configurationPromise` or the licensing promise is missing
     * (state-helpers.js), and both of those are properties the child mirrors off its parent — so a
     * mis-wiring leaves every embedded report on a loading spinner forever with nothing thrown.
     */
    it('resolves those issues through to derivedIssues', async () => {
      const parent = makeParent({
        jiraHelpers: {
          fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: () => Promise.resolve([jiraIssue('ONE-1')]),
        },
        // Exactly what the shell passes: route-data.js wires `configurationPromise` to
        // `normalizeOptions` too, not to state-helpers' `configurationPromise`.
        normalizeOptions: {},
        licensingPromise: Promise.resolve({ active: true }),
        fieldsToRequest: ['Status'],
      });

      const config = new ChildReportConfig({ queryParams: 'jql=project%20%3D%20ONE', parent });

      const derived = await config.derivedIssuesPromise;

      expect(derived.map((issue) => issue.key)).toEqual(['ONE-1']);
      expect(derived[0].summary).toBe('summary for ONE-1');
    });

    it('stays pending rather than throwing when the parent has no configuration yet', async () => {
      const parent = makeParent({
        jiraHelpers: {
          fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: () => Promise.resolve([jiraIssue('ONE-1')]),
        },
        // The bootstrap state: metadata hasn't landed, so `normalizeOptions` is still null.
        normalizeOptions: null,
        licensingPromise: Promise.resolve({ active: true }),
      });

      const config = new ChildReportConfig({ queryParams: 'jql=project%20%3D%20ONE', parent });
      const settled = await Promise.race([
        config.derivedIssuesPromise.then(() => 'settled'),
        Promise.resolve('pending'),
      ]);

      expect(settled).toBe('pending');
      expect(config.derivedIssues).toBeUndefined();
    });
  });

  describe('drift from route-data', () => {
    /**
     * Route-data props that are not report settings at all, so a child neither parses nor inherits
     * them as one. Enumerated by hand because the alternative — sniffing the definition's shape —
     * is what let three real params slip past this test before: `report` and `fullscreen` are built
     * by `saveJSONToUrl`, which emits no `serialize`, and `selectedIssueType` / `toIssueType` are
     * hand-rolled `value()` props. Anything genuinely new lands in the failure list until it is
     * classified deliberately.
     */
    const NOT_A_PARAM_KEYS = [
      // Injected infrastructure — shared off the parent, identical for every report on the page.
      'licensingPromise',
      'jiraHelpers',
      'isLoggedInObservable',
      'storage',
      'jiraFieldsPromise',
      'fieldMaps',
      'reportsData',
      'reports',
      // Derived data and the fetch pipeline — the child runs its own (see "its own fetch" above) or
      // mirrors the parent's.
      'simplifiedIssueHierarchy',
      'baseNormalizeOptions',
      'normalizeOptions',
      'fieldsToRequest',
      'allFieldsToRequest',
      'rawIssuesRequestData',
      'derivedIssuesRequestData',
      'derivedIssues',
      // CanJS's wildcard definition, not a property.
      '*',
    ];

    // Adding a per-report setting to route-data.js without adding it here would silently give every
    // embedded child that setting's default. This turns that into a build failure.
    it('accounts for every property route-data defines', () => {
      const accountedFor = new Set([
        ...CHILD_PARAM_KEYS,
        ...AD_HOC_CHILD_PARAM_KEYS,
        ...SHELL_ONLY_PARAM_KEYS,
        ...NOT_A_PARAM_KEYS,
      ]);

      // Getters on the props object are derived properties, never stored settings.
      const routeDataProps = Object.getOwnPropertyNames(RouteData.props).filter(
        (key) => !Object.getOwnPropertyDescriptor(RouteData.props, key).get,
      );

      expect(routeDataProps.filter((key) => !accountedFor.has(key))).toEqual([]);
    });

    // The buckets above are only as good as their coverage of the params that really exist, so pin
    // the two that this test used to miss entirely.
    it('classifies params that carry no serialize function', () => {
      const accountedFor = new Set([...CHILD_PARAM_KEYS, ...AD_HOC_CHILD_PARAM_KEYS, ...SHELL_ONLY_PARAM_KEYS]);

      expect(
        ['report', 'fullscreen', 'selectedIssueType', 'toIssueType'].filter((key) => !accountedFor.has(key)),
      ).toEqual([]);
    });

    it('keeps the per-child and shell-only buckets disjoint', () => {
      const shellOnly = new Set(SHELL_ONLY_PARAM_KEYS);

      expect(CHILD_PARAM_KEYS.filter((key) => shellOnly.has(key))).toEqual([]);
    });
  });
});
