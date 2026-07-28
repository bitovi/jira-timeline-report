import { ObservableObject, value } from '../../../../can';
import { RouteData } from '../../../../canjs/routing/route-data/route-data';
import { ChildReportConfig, CHILD_PARAM_KEYS, SHELL_ONLY_PARAM_KEYS } from './ChildReportConfig';

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
  });

  describe('drift from route-data', () => {
    // Adding a per-report setting to route-data.js without adding it here would silently give every
    // embedded child that setting's default. This turns that into a build failure.
    it('accounts for every report-aware parameter route-data defines', () => {
      const accountedFor = new Set([...CHILD_PARAM_KEYS, ...SHELL_ONLY_PARAM_KEYS]);

      const routeDataParams = Object.getOwnPropertyNames(RouteData.props).filter((key) => {
        const descriptor = Object.getOwnPropertyDescriptor(RouteData.props, key);

        if (descriptor.get) {
          return false;
        }

        const definition = descriptor.value;

        return !!definition && typeof definition === 'object' && typeof definition.serialize === 'function';
      });

      expect(routeDataParams.filter((key) => !accountedFor.has(key))).toEqual([]);
    });

    it('keeps the per-child and shell-only buckets disjoint', () => {
      const shellOnly = new Set(SHELL_ONLY_PARAM_KEYS);

      expect(CHILD_PARAM_KEYS.filter((key) => shellOnly.has(key))).toEqual([]);
    });
  });
});
