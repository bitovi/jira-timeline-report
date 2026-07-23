import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act, waitFor } from '@testing-library/react';

import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueFields } from './model/buildColumnCatalog';

// Mock the Jira fields hook so the report renders without a QueryClient/JiraProvider or Suspense
// backend. The catalog is derived purely from these fields.
const mockFields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Priority', key: 'priority', schema: { type: 'string' }, id: 'priority', custom: false },
  { name: 'Due date', key: 'duedate', schema: { type: 'date' }, id: 'duedate', custom: false },
];
vi.mock('../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => mockFields,
}));

import { TableReport } from './TableReport';

/**
 * Minimal writable CanObservable stub. `value` is a getter/setter so both `.set(v)` (used by
 * upstream data observables) and `obs.value = v` (how the report writes persisted state back, like
 * GroupingReport) update the live value and notify subscribers.
 */
const obs = <T,>(value: T): CanObservable<T> => {
  let current = value;
  const handlers = new Set<() => void>();
  const notify = () => handlers.forEach((h) => h());
  return {
    get value() {
      return current;
    },
    set value(v: T) {
      current = v;
      notify();
    },
    get: () => current,
    getData: () => current,
    set: (v: T) => {
      current = v;
      notify();
    },
    on: (h: () => void) => handlers.add(h),
    off: (h: () => void) => handlers.delete(h),
  } as unknown as CanObservable<T>;
};

/**
 * The Table report's PRIMARY controls (Rows / Group by / 2D dimension / Fields axis / Add column)
 * now live in a separate control bar (`TableReportControls`) tested in
 * `components/TableReportControls.test.tsx`. The report BODY renders purely from its route-data
 * observables, so these tests configure the view by seeding those observables directly (mirroring
 * how the controls write to the same keys) rather than by clicking a toolbar.
 */
const DEFAULT_COLUMNS = [
  { sourceId: 'identity:issueType' },
  { sourceId: 'identity:key' },
  { sourceId: 'identity:summary' },
];

const makeTableObs = () => ({
  tableColumnsObs: obs<any[]>([...DEFAULT_COLUMNS]),
  tableSortColumnObs: obs(''),
  tableSortDirObs: obs('asc'),
  tableFiltersObs: obs<Record<string, unknown>>({}),
  tableGroupByObs: obs(''),
  tableGroupByColObs: obs(''),
  tableGroupByGranularityObs: obs(''),
  tableGroupByColGranularityObs: obs(''),
  tableFieldAxisObs: obs('rows'),
  tableShowRowTotalsObs: obs(false),
  tableShowColTotalsObs: obs(false),
});

/** Build a fake linked/derived issue with just the slices the column model reads. */
const makeIssue = (key: string, summary: string) =>
  ({
    key,
    summary,
    url: `https://example.test/${key}`,
    hierarchyLevel: 1,
    parentKey: null,
    derivedTiming: { deterministicTotalDaysOfWork: 0 },
    issue: { fields: { 'Issue Type': { iconUrl: '' } } },
  }) as any;

const renderReport = (issues: any[], tableObs?: ReturnType<typeof makeTableObs>) =>
  render(
    <TableReport
      filteredDerivedIssuesObs={obs(issues)}
      rollupTimingLevelsAndCalculationsObs={obs([{ hierarchyLevel: 1 }])}
      {...((tableObs ?? makeTableObs()) as any)}
    />,
  );

/** A rolled-up issue with the slices hierarchy mode reads (childKeys + rollup timing). */
const makeRollup = (key: string, summary: string, childKeys: string[] = []) =>
  ({
    key,
    summary,
    url: `https://example.test/${key}`,
    reportingHierarchy: { childKeys },
    derivedTiming: {},
    completionRollup: { totalWorkingDays: 3 },
    issue: { fields: { 'Issue Type': { iconUrl: '' } } },
  }) as any;

afterEach(() => cleanup());

describe('TableReport (flat body)', () => {
  const issues = [makeIssue('AAA-2', 'Beta task'), makeIssue('AAA-1', 'Alpha task')];

  test('renders the default columns and a row per loaded issue', () => {
    renderReport(issues);
    expect(screen.getByText('Issue key')).toBeInTheDocument();
    expect(screen.getByText('Summary')).toBeInTheDocument();
    expect(screen.getByText('Issue type')).toBeInTheDocument();
    expect(screen.getByText('AAA-1')).toBeInTheDocument();
    expect(screen.getByText('AAA-2')).toBeInTheDocument();
  });

  test('flat mode shows issues across ALL hierarchy levels (no top-level filter)', () => {
    // Two issues at DIFFERENT hierarchy levels — both must render in flat mode.
    const parent = makeIssue('AAA-1', 'Parent');
    const child = { ...makeIssue('AAA-2', 'Child'), hierarchyLevel: 2 };
    renderReport([parent, child]);
    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(screen.getByText('AAA-1')).toBeInTheDocument();
    expect(screen.getByText('AAA-2')).toBeInTheDocument();
  });

  test('flat mode prefers the rolled-up issue set when present (all levels, with rollups)', () => {
    const parent = makeRollup('AAA-1', 'Parent', ['AAA-2']);
    const child = makeRollup('AAA-2', 'Child');
    render(
      <TableReport
        filteredDerivedIssuesObs={obs([])}
        rollupTimingLevelsAndCalculationsObs={obs([{ hierarchyLevel: 1 }])}
        primaryIssuesOrReleasesObs={obs([parent])}
        allIssuesOrReleasesObs={obs([parent, child])}
        {...(makeTableObs() as any)}
      />,
    );
    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(screen.getByText('AAA-1')).toBeInTheDocument();
    expect(screen.getByText('AAA-2')).toBeInTheDocument();
  });

  test('clicking the Summary header cycles Hierarchy then ascending sort', () => {
    const t = makeTableObs();
    renderReport(issues, t);
    const findSummary = () =>
      screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith('Summary'))!;
    // Summary is tree-capable: first click = Hierarchy, second = ascending sort.
    fireEvent.click(findSummary());
    expect(t.tableSortColumnObs.get()).toBe('identity:summary');
    expect(t.tableSortDirObs.get()).toBe('tree');
    fireEvent.click(findSummary());
    expect(t.tableSortDirObs.get()).toBe('asc');

    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    const firstRowKey = within(bodyRows[0] as HTMLElement).getByText(/AAA-/).textContent;
    // "Alpha task" sorts before "Beta task", so AAA-1 comes first.
    expect(firstRowKey).toBe('AAA-1');
    expect(findSummary().textContent).toContain('▲');
  });

  test('further clicks on the Summary header reach descending, then Rank order', async () => {
    const ranked = [
      { ...makeIssue('AAA-2', 'Beta task'), rank: '0|a' },
      { ...makeIssue('AAA-1', 'Alpha task'), rank: '0|b' },
    ];
    const t = makeTableObs();
    renderReport(ranked, t);
    const findSummary = () =>
      screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith('Summary'))!;
    // Each click's row-recompute is driven by two SEPARATE observable writes (`setSort` sets
    // `sortColumnObs` then `sortDirObs`), each notifying its own `useCanObservable` subscriber. Wrap
    // every click in an async `act()` so React flushes both resulting state updates (and any pending
    // microtasks) before the next click fires — this is what made the test flaky (later clicks could
    // fire against a stale intermediate render).
    await act(async () => void fireEvent.click(findSummary())); // tree
    await act(async () => void fireEvent.click(findSummary())); // asc
    await act(async () => void fireEvent.click(findSummary())); // desc
    expect(t.tableSortDirObs.get()).toBe('desc');
    await act(async () => void fireEvent.click(findSummary())); // rank
    expect(t.tableSortDirObs.get()).toBe('rank');

    // AAA-2 has the earlier rank ('0|a'), so it comes first — even though it sorts AFTER AAA-1
    // alphabetically ('Beta' > 'Alpha'). `waitFor` guards against the DOM lagging one tick behind
    // the observable state on a slow/loaded run.
    await waitFor(() => {
      const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
      const firstRowKey = within(bodyRows[0] as HTMLElement).getByText(/AAA-/).textContent;
      expect(firstRowKey).toBe('AAA-2');
    });
  });

  test('right-aligns a numeric field column (header + cells) but not a text column', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'field:priority' }, { sourceId: 'field:customfield_1' }]);
    const issue = {
      key: 'AAA-1',
      summary: 'AAA-1 summary',
      url: 'https://example.test/AAA-1',
      hierarchyLevel: 1,
      parentKey: null,
      derivedTiming: {},
      issue: { fields: { 'Issue Type': { iconUrl: '' }, Priority: 'High', 'Story Points': 3 } },
    } as any;
    renderReport([issue], tableObs);

    const pointsHeader = screen
      .getAllByTestId('table-header-sort')
      .find((b) => b.textContent?.startsWith('Story Points'))!;
    expect(pointsHeader.closest('th')).toHaveClass('text-right');
    const priorityHeader = screen
      .getAllByTestId('table-header-sort')
      .find((b) => b.textContent?.startsWith('Priority'))!;
    expect(priorityHeader.closest('th')).not.toHaveClass('text-right');

    expect(screen.getByText('3').closest('td')).toHaveClass('text-right');
    expect(screen.getByText('High').closest('td')).not.toHaveClass('text-right');
  });
});

describe('TableReport (hierarchy body)', () => {
  const parent = makeRollup('AAA-1', 'Parent', ['AAA-2']);
  const child = makeRollup('AAA-2', 'Child');

  const renderHierarchy = () =>
    render(
      <TableReport
        filteredDerivedIssuesObs={obs([])}
        rollupTimingLevelsAndCalculationsObs={obs([{ hierarchyLevel: 1 }])}
        primaryIssuesOrReleasesObs={obs([parent])}
        allIssuesOrReleasesObs={obs([parent, child])}
        {...(makeTableObs() as any)}
        tableSortColumnObs={obs('identity:summary')}
        tableSortDirObs={obs('tree')}
      />,
    );

  test('hierarchy ordering flattens the tree depth-first with a caret on parents', () => {
    renderHierarchy();

    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(2);
    expect(within(bodyRows[0] as HTMLElement).getByText('AAA-1')).toBeInTheDocument();
    expect(within(bodyRows[1] as HTMLElement).getByText('AAA-2')).toBeInTheDocument();
    // The parent row has an expand/collapse caret; the leaf child does not.
    expect(within(bodyRows[0] as HTMLElement).getByTestId('table-tree-caret')).toBeInTheDocument();
    expect(within(bodyRows[1] as HTMLElement).queryByTestId('table-tree-caret')).not.toBeInTheDocument();
  });

  test('collapsing a parent hides its descendants', () => {
    renderHierarchy();
    fireEvent.click(screen.getByTestId('table-tree-caret'));

    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(1);
    expect(within(bodyRows[0] as HTMLElement).getByText('AAA-1')).toBeInTheDocument();
  });

  test('siblings under the same parent default to Jira Rank order (not source/childKeys order)', () => {
    const rankedParent = makeRollup('AAA-1', 'Parent', ['AAA-2', 'AAA-3']);
    // childKeys lists AAA-2 before AAA-3, but AAA-3's rank sorts earlier.
    const childB = { ...makeRollup('AAA-2', 'Child B'), rank: '0|c' };
    const childA = { ...makeRollup('AAA-3', 'Child A'), rank: '0|a' };
    render(
      <TableReport
        filteredDerivedIssuesObs={obs([])}
        rollupTimingLevelsAndCalculationsObs={obs([{ hierarchyLevel: 1 }])}
        primaryIssuesOrReleasesObs={obs([rankedParent])}
        allIssuesOrReleasesObs={obs([rankedParent, childB, childA])}
        {...(makeTableObs() as any)}
        tableSortColumnObs={obs('identity:summary')}
        tableSortDirObs={obs('tree')}
      />,
    );

    const bodyRows = screen.getByRole('table').querySelectorAll('tbody tr');
    expect(bodyRows).toHaveLength(3);
    expect(within(bodyRows[0] as HTMLElement).getByText('AAA-1')).toBeInTheDocument();
    // AAA-3 (rank '0|a') orders before AAA-2 (rank '0|c').
    expect(within(bodyRows[1] as HTMLElement).getByText('AAA-3')).toBeInTheDocument();
    expect(within(bodyRows[2] as HTMLElement).getByText('AAA-2')).toBeInTheDocument();
  });
});

describe('TableReport (1D grouping body)', () => {
  /** An issue carrying Status + Story Points fields (keyed by display name, as the pipeline does). */
  const makeGrouped = (key: string, status: string, points: number) =>
    ({
      key,
      summary: `${key} summary`,
      url: `https://example.test/${key}`,
      hierarchyLevel: 1,
      parentKey: null,
      status,
      derivedTiming: {},
      issue: { fields: { 'Issue Type': { iconUrl: '' }, Status: status, 'Story Points': points } },
    }) as any;

  const groupedIssues = [
    makeGrouped('AAA-1', 'Done', 3),
    makeGrouped('AAA-2', 'To Do', 5),
    makeGrouped('AAA-3', 'Done', 2),
  ];

  /** Seed the observables: Story Points shown as a (measure) column, grouped by Status. */
  const setupGrouped = () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    renderReport(groupedIssues, tableObs);
    return tableObs;
  };

  test('renders collapsed group headers with member counts and aggregated measures by default', () => {
    setupGrouped();

    const headers = screen.getAllByTestId('table-group-header');
    // Two groups: Done (2 members) and To Do (1 member).
    expect(headers).toHaveLength(2);
    expect(screen.getByText('Done')).toBeInTheDocument();
    expect(screen.getByText('To Do')).toBeInTheDocument();

    const counts = screen.getAllByTestId('table-group-count').map((n) => n.textContent);
    expect(counts).toContain('(2)');
    expect(counts).toContain('(1)');

    // Collapsed by default → no member rows.
    expect(screen.queryByTestId('table-group-member')).not.toBeInTheDocument();

    // The Done group's Story Points measure (last shown column) defaults to Sum = 3 + 2 = 5.
    // The other shown columns (Issue type/Key/Summary identity columns) are ALSO measures now, so
    // there are multiple `table-group-measure` cells per group header — Story Points is the last.
    const doneHeader = headers.find((h) => h.textContent?.includes('Done'))!;
    const measures = within(doneHeader).getAllByTestId('table-group-measure');
    expect(measures.at(-1)?.textContent).toBe('5');
  });

  test('right-aligns the numeric Sum measure cell but not the identity Distinct-list measure cells', () => {
    setupGrouped();
    const doneHeader = screen.getAllByTestId('table-group-header').find((h) => h.textContent?.includes('Done'))!;
    const measures = within(doneHeader).getAllByTestId('table-group-measure');
    // Shown columns: Issue type (defaults to Count \u2192 numeric), Issue key (Distinct list), Summary
    // (Distinct list), Story Points (Sum \u2192 numeric). Only the Distinct-list measures stay left-aligned.
    expect(measures[0]).toHaveClass('text-right'); // Issue type \u2192 Count
    expect(measures[1]).not.toHaveClass('text-right'); // Issue key \u2192 Distinct list
    expect(measures[2]).not.toHaveClass('text-right'); // Summary \u2192 Distinct list
    expect(measures[3]).toHaveClass('text-right'); // Story Points \u2192 Sum
  });

  test('expanding a group reveals its member rows', () => {
    setupGrouped();
    const doneHeader = screen.getAllByTestId('table-group-header').find((h) => h.textContent?.includes('Done'))!;
    fireEvent.click(within(doneHeader).getByTestId('table-group-caret'));

    const members = screen.getAllByTestId('table-group-member');
    expect(members).toHaveLength(2);
    expect(within(members[0]).getByText('AAA-1')).toBeInTheDocument();
  });

  test('the grouped view renders the Order groups + Expand/Collapse strip', () => {
    setupGrouped();
    expect(screen.getByTestId('table-group-controls')).toBeInTheDocument();
    expect(screen.getByTestId('table-group-sort')).toBeInTheDocument();
    expect(screen.getByTestId('table-expand-all')).toBeInTheDocument();
    expect(screen.getByTestId('table-collapse-all')).toBeInTheDocument();
  });

  test('Expand all reveals members and Collapse all hides them', () => {
    setupGrouped();
    fireEvent.click(screen.getByTestId('table-expand-all'));
    expect(screen.getAllByTestId('table-group-member').length).toBe(3);
    fireEvent.click(screen.getByTestId('table-collapse-all'));
    expect(screen.queryByTestId('table-group-member')).not.toBeInTheDocument();
  });

  test.each([
    ['identity:treeSummary', 'AAA-1 summary'],
    ['identity:summary', 'AAA-1 summary'],
    ['identity:key', 'AAA-1'],
  ])('grouping by an identity/tree column (%s) links the group label to its issue', (sourceId, expectedText) => {
    const tableObs = makeTableObs();
    tableObs.tableGroupByObs.set(sourceId);
    // Each issue has a distinct key/summary, so every group has exactly one member.
    renderReport([makeGrouped('AAA-1', 'Done', 3), makeGrouped('AAA-2', 'To Do', 5)], tableObs);

    // Scope to the group-label cell (the caret's <td>) — the other shown identity columns
    // (Key/Summary) now ALSO render as links in their own `table-group-identity-list` cells, so a
    // page-wide query for the same text could match more than once.
    const labelCell = screen.getAllByTestId('table-group-caret')[0].closest('td')!;
    const link = within(labelCell).getByRole('link', { name: expectedText });
    expect(link).toHaveAttribute('href', 'https://example.test/AAA-1');
  });

  test('grouping by a non-identity column (Status) keeps the group label as plain text', () => {
    setupGrouped();
    const doneHeader = screen.getAllByTestId('table-group-header').find((h) => h.textContent?.includes('Done'))!;
    const labelCell = within(doneHeader).getByTestId('table-group-caret').closest('td')!;
    expect(within(labelCell).queryByRole('link')).not.toBeInTheDocument();
  });

  test('grouping by a non-identity column (Status) links each distinct Summary in its measure cell (default Distinct aggregation)', () => {
    setupGrouped();
    const doneHeader = screen.getAllByTestId('table-group-header').find((h) => h.textContent?.includes('Done'))!;
    // The Done group has 2 members (AAA-1, AAA-3) with distinct summaries — the Summary column is
    // now a real (aggregation-switchable) measure defaulting to Distinct, which renders each entry
    // as its own link (not a plain comma-joined string).
    const measureCells = within(doneHeader).getAllByTestId('table-group-measure');
    const summaryCell = measureCells.find((cell) => cell.textContent?.includes('summary'))!;
    const links = within(summaryCell).getAllByRole('link');
    expect(links.map((l) => l.textContent)).toEqual(['AAA-1 summary', 'AAA-3 summary']);
    expect(links[0]).toHaveAttribute('href', 'https://example.test/AAA-1');
    expect(links[1]).toHaveAttribute('href', 'https://example.test/AAA-3');
  });

  test('switching the Summary column aggregation from Distinct to Count renders a plain count instead of links', () => {
    setupGrouped();
    const summaryHeader = screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith('Summary'))!;
    const th = summaryHeader.closest('th') as HTMLElement;
    fireEvent.click(within(th).getByTestId('table-column-menu-trigger'));

    const menu = screen.getByTestId('table-aggregation-menu');
    expect(within(menu).getByTestId('table-aggregation-distinct')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(menu).getByTestId('table-aggregation-count'));

    const doneHeader = screen.getAllByTestId('table-group-header').find((h) => h.textContent?.includes('Done'))!;
    // Column order: Issue type, Issue key, Summary, Story Points → Summary is the 3rd measure cell.
    const measureCells = within(doneHeader).getAllByTestId('table-group-measure');
    expect(within(measureCells[2]).queryByRole('link')).not.toBeInTheDocument();
    expect(measureCells[2].textContent).toBe('2');
  });
});

describe('TableReport (date-bucket grouping body, spec/012-table-and-grouper/date-bucket-grouping.md)', () => {
  /** An issue carrying a raw "Due date" field (keyed by display name, as the pipeline does). */
  const makeDated = (key: string, due: string) =>
    ({
      key,
      summary: `${key} summary`,
      url: `https://example.test/${key}`,
      hierarchyLevel: 1,
      parentKey: null,
      derivedTiming: {},
      issue: { fields: { 'Issue Type': { iconUrl: '' }, 'Due date': due } },
    }) as any;

  const datedIssues = [
    makeDated('AAA-1', '2024-01-05T10:00:00.000Z'),
    makeDated('AAA-2', '2024-01-20T03:00:00.000Z'),
    makeDated('AAA-3', '2024-02-10T00:00:00.000Z'),
  ];

  test('with no granularity set, a date group column defaults to Day (not the raw full-timestamp value)', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:duedate' }]);
    tableObs.tableGroupByObs.set('field:duedate');
    // Three DIFFERENT calendar days → three groups even at Day granularity (proves it isn't
    // grouping by the raw millisecond timestamp, but it also isn't over-merging).
    renderReport(datedIssues, tableObs);
    expect(screen.getAllByTestId('table-group-header')).toHaveLength(3);
    expect(screen.getByText('2024-01-05')).toBeInTheDocument();
    expect(screen.getByText('2024-01-20')).toBeInTheDocument();
    expect(screen.getByText('2024-02-10')).toBeInTheDocument();
  });

  test('Month granularity buckets same-month issues into one group', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:duedate' }]);
    tableObs.tableGroupByObs.set('field:duedate');
    tableObs.tableGroupByGranularityObs.set('month');
    renderReport(datedIssues, tableObs);

    // AAA-1 + AAA-2 (both January) collapse into one group; AAA-3 (February) is the other.
    const headers = screen.getAllByTestId('table-group-header');
    expect(headers).toHaveLength(2);
    expect(screen.getByText('2024-01')).toBeInTheDocument();
    expect(screen.getByText('2024-02')).toBeInTheDocument();

    const janHeader = headers.find((h) => h.textContent?.includes('2024-01'))!;
    expect(within(janHeader).getByTestId('table-group-count').textContent).toBe('(2)');
  });

  test('the grouped column header shows the field name with its granularity', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:duedate' }]);
    tableObs.tableGroupByObs.set('field:duedate');
    tableObs.tableGroupByGranularityObs.set('quarter');
    renderReport(datedIssues, tableObs);
    const header = screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith('Due date'))!;
    expect(header.textContent).toContain('Due date (Quarter)');
  });
});

describe('TableReport (2D cross-tab body)', () => {
  /** An issue carrying Status + Priority + Story Points fields (keyed by display name). */
  const make2D = (key: string, status: string, priority: string, points: number) =>
    ({
      key,
      summary: `${key} summary`,
      url: `https://example.test/${key}`,
      hierarchyLevel: 1,
      parentKey: null,
      status,
      derivedTiming: {},
      issue: { fields: { 'Issue Type': { iconUrl: '' }, Status: status, Priority: priority, 'Story Points': points } },
    }) as any;

  // rows = Status {Done, To Do}; cols = Priority {High, Low}. Story Points is the sole measure —
  // the default identity columns are deliberately left out of the shown-column set here so these
  // aggregation-mechanics tests aren't also exercising the (separately tested) multi-measure
  // identity-columns-as-measures behavior.
  const twoDIssues = [
    make2D('AAA-1', 'Done', 'High', 3),
    make2D('AAA-2', 'To Do', 'Low', 5),
    make2D('AAA-3', 'Done', 'High', 2),
  ];

  /** Seed: Story Points shown, grouped by Status (rows) with Priority as the 2D column dimension.
   * Totals default OFF app-wide, but this describe block is testing totals AGGREGATION correctness
   * (not the on/off toggle itself, covered separately below), so both are explicitly enabled here. */
  const setup2D = () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    tableObs.tableShowRowTotalsObs.set(true);
    tableObs.tableShowColTotalsObs.set(true);
    renderReport(twoDIssues, tableObs);
    return tableObs;
  };

  test('renders a cross-tab with both axes, per-cell (row ∩ col) aggregation, and a total column/row', () => {
    setup2D();
    const table = screen.getByTestId('table-crosstab');
    // Row-axis label header = the grouped row field; column-value + total headers present.
    expect(within(table).getByTestId('table-crosstab-row-label').textContent).toBe('Status');
    expect(within(table).getByText('High')).toBeInTheDocument();
    expect(within(table).getByText('Low')).toBeInTheDocument();
    expect(within(table).getAllByText('Total').length).toBeGreaterThan(0);

    // Done ∩ High story points = 3 + 2 = 5; Done row total = 5; To Do ∩ Low = 5.
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    const doneCells = within(doneRow)
      .getAllByTestId('table-crosstab-cell')
      .map((c) => c.textContent);
    // [High, Low, Total] → 5, · (empty), 5.
    expect(doneCells).toEqual(['5', '·', '5']);

    // Grand total row aggregates down the row axis: High col total = 5, Low = 5, grand = 10.
    const totalRow = within(table).getByTestId('table-crosstab-total-row');
    expect(
      within(totalRow)
        .getAllByTestId('table-crosstab-cell')
        .map((c) => c.textContent),
    ).toEqual(['5', '5', '10']);
  });

  test('totals are OFF by default: no total row/column and no "Total" text at all', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    renderReport(twoDIssues, tableObs);

    const table = screen.getByTestId('table-crosstab');
    expect(within(table).queryByTestId('table-crosstab-total-row')).not.toBeInTheDocument();
    expect(within(table).queryByText('Total')).not.toBeInTheDocument();
    // Only the two real column values (High/Low) — no synthetic Total column added to each row.
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    expect(within(doneRow).getAllByTestId('table-crosstab-cell')).toHaveLength(2);
  });

  test('row totals and column totals toggle independently via their own observables', () => {
    const tableObs = setup2D();
    // setup2D turns both on — flip both off first to exercise from a known baseline.
    act(() => {
      tableObs.tableShowRowTotalsObs.set(false);
      tableObs.tableShowColTotalsObs.set(false);
    });
    let table = screen.getByTestId('table-crosstab');
    expect(within(table).queryByTestId('table-crosstab-total-row')).not.toBeInTheDocument();
    expect(within(table).queryByText('Total')).not.toBeInTheDocument();

    // Row totals ON, column totals still OFF: a Total COLUMN appears (extra cell per row), but no
    // Total ROW.
    act(() => tableObs.tableShowRowTotalsObs.set(true));
    table = screen.getByTestId('table-crosstab');
    expect(within(table).queryByTestId('table-crosstab-total-row')).not.toBeInTheDocument();
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    // [High, Low, Total] → 5, ·, 5 — same aggregation as the "both on" test above.
    expect(
      within(doneRow)
        .getAllByTestId('table-crosstab-cell')
        .map((c) => c.textContent),
    ).toEqual(['5', '·', '5']);

    // Now flip row totals back off and column totals on: a Total ROW appears (bottom), but each row
    // goes back to just its two real column cells (no Total column).
    act(() => {
      tableObs.tableShowRowTotalsObs.set(false);
      tableObs.tableShowColTotalsObs.set(true);
    });
    table = screen.getByTestId('table-crosstab');
    expect(
      within(within(table).getAllByTestId('table-crosstab-row')[0]).getAllByTestId('table-crosstab-cell'),
    ).toHaveLength(2);
    const totalRow = within(table).getByTestId('table-crosstab-total-row');
    // Grand total row, no Total column: [High total = 5, Low total = 5].
    expect(
      within(totalRow)
        .getAllByTestId('table-crosstab-cell')
        .map((c) => c.textContent),
    ).toEqual(['5', '5']);
  });

  test('the fields-axis observable drives both cross-tab layouts', () => {
    const tableObs = setup2D();
    // Default is Down rows.
    expect(screen.getByTestId('table-crosstab').getAttribute('data-field-axis')).toBe('rows');
    // Flipping the observable (as the Fields control would) re-renders as Across cols.
    act(() => tableObs.tableFieldAxisObs.set('cols'));
    expect(screen.getByTestId('table-crosstab').getAttribute('data-field-axis')).toBe('cols');
    const table = screen.getByTestId('table-crosstab');
    expect(within(table).getByText('High')).toBeInTheDocument();
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    expect(within(doneRow).getAllByTestId('table-crosstab-cell')[0].textContent).toBe('5');
  });

  test('"hidden" drops the redundant per-row Field column when there is a single measure', () => {
    const tableObs = setup2D();
    act(() => tableObs.tableFieldAxisObs.set('hidden'));

    const table = screen.getByTestId('table-crosstab');
    expect(table.getAttribute('data-field-axis')).toBe('hidden');
    // No separate "Field" column header, and the measure's name/agg-tag aren't shown anywhere at
    // all — the row-label header is just the row-field's own label.
    const rowLabelHeader = within(table).getByTestId('table-crosstab-row-label');
    expect(rowLabelHeader.textContent).toBe('Status');
    expect(within(table).queryByText('Story Points')).not.toBeInTheDocument();
    expect(within(table).queryByText('Sum')).not.toBeInTheDocument();

    // Values still compute correctly: Done ∩ High story points = 3 + 2 = 5.
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    expect(
      within(doneRow)
        .getAllByTestId('table-crosstab-cell')
        .map((c) => c.textContent),
    ).toEqual(['5', '·', '5']);
  });

  test('"hidden" falls back to Down rows when more than one measure is shown', () => {
    const tableObs = makeTableObs();
    // Two measures shown (Summary, Story Points) → hiding the Field column would be ambiguous.
    tableObs.tableColumnsObs.set([{ sourceId: 'identity:summary' }, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    tableObs.tableFieldAxisObs.set('hidden');
    renderReport(twoDIssues, tableObs);

    const table = screen.getByTestId('table-crosstab');
    expect(table.getAttribute('data-field-axis')).toBe('rows');
    expect(within(table).getAllByText('Summary').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Story Points').length).toBeGreaterThan(0);
  });

  test('falls back to listing the shown identity columns so rows still render when no real measures exist', () => {
    // Reproduces the empty-table bug: with only the default identity "Icon & Summary" column shown,
    // both grouped fields plus identity are excluded from the measures, leaving none — the cross-tab
    // must fall back to the identity column itself (labeled with its aggregation) instead of
    // collapsing to zero rows.
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'identity:treeSummary' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    renderReport(twoDIssues, tableObs);

    const table = screen.getByTestId('table-crosstab');
    // The fallback measure is the shown "Icon & Summary" identity column, tagged with its
    // aggregation ("Distinct list") in the Field column — not a synthetic "Issue Count".
    expect(within(table).getAllByText('Icon & Summary').length).toBeGreaterThan(0);
    expect(within(table).getAllByText('Distinct list').length).toBeGreaterThan(0);
    expect(within(table).queryByText('Issue Count')).not.toBeInTheDocument();

    // Done ∩ High lists both Done/High issue summaries; Done ∩ Low is empty.
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    const doneCells = within(doneRow)
      .getAllByTestId('table-crosstab-cell')
      .map((c) => c.textContent);
    expect(doneCells[0]).toContain('AAA-1 summary');
    expect(doneCells[0]).toContain('AAA-3 summary');
    expect(doneCells[1]).toBe('·'); // Done ∩ Low empty
  });

  test('a cross-tab measure offers an Aggregation menu that recomputes the cells', () => {
    setup2D();
    fireEvent.click(screen.getAllByRole('button', { name: 'Story Points column options' })[0]);

    const menu = screen.getByTestId('table-aggregation-menu');
    // Story Points defaults to Sum, which the cross-tab already shows as the agg-tag.
    expect(within(menu).getByTestId('table-aggregation-sum')).toHaveAttribute('aria-pressed', 'true');

    fireEvent.click(within(menu).getByTestId('table-aggregation-avg'));

    const table = screen.getByTestId('table-crosstab');
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    // Done ∩ High average of [3, 2] = 2.5 (was the Sum, 5).
    expect(within(doneRow).getAllByTestId('table-crosstab-cell')[0].textContent).toBe('2.5');
  });

  test('a shown identity column (Summary) is a switchable cross-tab measure: Distinct link-list → Count', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'identity:summary' }, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    renderReport(twoDIssues, tableObs);

    const table = screen.getByTestId('table-crosstab');
    // Two measures shown (Summary, Story Points) → two sub-rows per Status group; Summary is first.
    const summaryRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    // Default aggregation (Distinct) renders each distinct Done ∩ High summary as its own link.
    const distinctCell = within(summaryRow).getAllByTestId('table-crosstab-cell')[0];
    expect(
      within(distinctCell)
        .getAllByRole('link')
        .map((l) => l.textContent),
    ).toEqual(['AAA-1 summary', 'AAA-3 summary']);

    fireEvent.click(screen.getAllByRole('button', { name: 'Summary column options' })[0]);
    const menu = screen.getByTestId('table-aggregation-menu');
    expect(within(menu).getByTestId('table-aggregation-distinct')).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(within(menu).getByTestId('table-aggregation-count'));

    const countRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    const countCell = within(countRow).getAllByTestId('table-crosstab-cell')[0];
    expect(within(countCell).queryByRole('link')).not.toBeInTheDocument();
    expect(countCell.textContent).toBe('2');
  });

  test('removing a cross-tab measure via its ⋯ menu drops it from the shown columns', () => {
    const tableObs = setup2D();
    fireEvent.click(screen.getAllByRole('button', { name: 'Story Points column options' })[0]);
    fireEvent.click(screen.getByTestId('table-remove-column'));

    expect(tableObs.tableColumnsObs.get().map((e: any) => e.sourceId)).not.toContain('field:customfield_1');
  });

  test('the cross-tab measure menu is also present in the "across cols" layout', () => {
    const tableObs = setup2D();
    act(() => tableObs.tableFieldAxisObs.set('cols'));
    expect(screen.getAllByRole('button', { name: 'Story Points column options' }).length).toBeGreaterThan(0);
  });

  test('right-aligns numeric (Sum) cross-tab cells', () => {
    setup2D();
    const table = screen.getByTestId('table-crosstab');
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    for (const cell of within(doneRow).getAllByTestId('table-crosstab-cell')) {
      expect(cell).toHaveClass('text-right');
    }
  });

  test('left-aligns non-numeric (Distinct list) cross-tab cells', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([{ sourceId: 'identity:treeSummary' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    renderReport(twoDIssues, tableObs);

    const table = screen.getByTestId('table-crosstab');
    const doneRow = within(table)
      .getAllByTestId('table-crosstab-row')
      .find((r) => r.textContent?.includes('Done'))!;
    for (const cell of within(doneRow).getAllByTestId('table-crosstab-cell')) {
      expect(cell).not.toHaveClass('text-right');
      expect(cell).toHaveClass('text-left');
    }
  });
});

describe('TableReport (per-column aggregation menu availability)', () => {
  const openMenuFor = (label: string) => {
    const header = screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith(label))!;
    const th = header.closest('th') as HTMLElement;
    fireEvent.click(within(th).getByTestId('table-column-menu-trigger'));
  };

  test('an ungrouped flat view still offers Aggregation, hinting it is inert until grouped', () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    renderReport([makeIssue('AAA-1', 'Alpha')], tableObs);

    openMenuFor('Story Points');
    const menu = screen.getByTestId('table-aggregation-menu');
    expect(within(menu).getByText('Aggregation (used when grouped)')).toBeInTheDocument();
    // Story Points is a number column → Sum/Avg/Min/Max/Count options.
    expect(within(menu).getByTestId('table-aggregation-sum')).toBeInTheDocument();
    expect(within(menu).getByTestId('table-aggregation-avg')).toBeInTheDocument();
    expect(within(menu).queryByTestId('table-aggregation-distinct')).not.toBeInTheDocument();

    fireEvent.click(within(menu).getByTestId('table-aggregation-avg'));
    const entries = tableObs.tableColumnsObs.get();
    expect(entries.find((e: any) => e.sourceId === 'field:customfield_1').aggregation).toBe('avg');
  });

  test('a hierarchy (tree) view offers Aggregation too, inert until parent rollup is wired up', () => {
    const parent = makeRollup('AAA-1', 'Parent', ['AAA-2']);
    const child = makeRollup('AAA-2', 'Child');
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    tableObs.tableSortColumnObs.set('identity:summary');
    tableObs.tableSortDirObs.set('tree');
    render(
      <TableReport
        filteredDerivedIssuesObs={obs([])}
        rollupTimingLevelsAndCalculationsObs={obs([{ hierarchyLevel: 1 }])}
        primaryIssuesOrReleasesObs={obs([parent])}
        allIssuesOrReleasesObs={obs([parent, child])}
        {...(tableObs as any)}
      />,
    );

    openMenuFor('Story Points');
    expect(screen.getByTestId('table-aggregation-menu')).toBeInTheDocument();
    expect(screen.getByText('Aggregation (used when grouped)')).toBeInTheDocument();
  });

  test('a 1D grouped view drops the "(used when grouped)" hint since it now affects the group rollups', () => {
    const makeGrouped = (key: string, status: string, points: number) =>
      ({
        key,
        summary: `${key} summary`,
        url: `https://example.test/${key}`,
        hierarchyLevel: 1,
        parentKey: null,
        status,
        derivedTiming: {},
        issue: { fields: { 'Issue Type': { iconUrl: '' }, Status: status, 'Story Points': points } },
      }) as any;
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    renderReport([makeGrouped('AAA-1', 'Done', 3), makeGrouped('AAA-2', 'To Do', 5)], tableObs);

    openMenuFor('Story Points');
    expect(screen.getByText('Aggregation')).toBeInTheDocument();
    expect(screen.queryByText('Aggregation (used when grouped)')).not.toBeInTheDocument();
  });
});

describe('TableReport (persistence body)', () => {
  const issues = [makeIssue('AAA-2', 'Beta task'), makeIssue('AAA-1', 'Alpha task')];

  const renderWithObs = (tableObs: ReturnType<typeof makeTableObs>) => renderReport(issues, tableObs);

  test('renders columns from the persisted tableColumns observable', () => {
    const tableObs = makeTableObs();
    // Persist a Story Points column ahead of render — it must show up (survives "reload").
    tableObs.tableColumnsObs.set([{ sourceId: 'field:customfield_1' }, { sourceId: 'identity:key' }] as any);
    renderWithObs(tableObs);
    const headers = screen.getAllByTestId('table-header-sort').map((b) => b.textContent);
    expect(headers.some((t) => t?.startsWith('Story Points'))).toBe(true);
  });

  test('sorting writes back to the sort observables', () => {
    const tableObs = makeTableObs();
    renderWithObs(tableObs);
    const summaryHeader = screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith('Summary'))!;
    // Summary is tree-capable, so the first header click selects the Hierarchy (tree) sort mode.
    fireEvent.click(summaryHeader);
    expect(tableObs.tableSortColumnObs.get()).toBe('identity:summary');
    expect(tableObs.tableSortDirObs.get()).toBe('tree');
  });
});

describe('TableReport (column reordering)', () => {
  const issues = [makeIssue('AAA-2', 'Beta task'), makeIssue('AAA-1', 'Alpha task')];

  const headerLabels = () => screen.getAllByTestId('table-header-sort').map((b) => b.textContent?.trim());

  const openMenuFor = (label: string) => {
    const header = screen.getAllByTestId('table-header-sort').find((b) => b.textContent?.startsWith(label))!;
    const th = header.closest('th') as HTMLElement;
    fireEvent.click(within(th).getByTestId('table-column-menu-trigger'));
  };

  test('"Move right" shifts a column one position toward the end and persists it', () => {
    const tableObs = makeTableObs();
    renderReport(issues, tableObs);
    // Order starts: Issue type | Issue key | Summary.
    expect(headerLabels()).toEqual(['Issue type', 'Issue key', 'Summary']);

    openMenuFor('Issue type');
    fireEvent.click(screen.getByTestId('table-move-right'));

    expect(headerLabels()).toEqual(['Issue key', 'Issue type', 'Summary']);
    expect(tableObs.tableColumnsObs.get().map((e: any) => e.sourceId)).toEqual([
      'identity:key',
      'identity:issueType',
      'identity:summary',
    ]);
  });

  test('"Move left" shifts a column one position toward the start and persists it', () => {
    const tableObs = makeTableObs();
    renderReport(issues, tableObs);

    openMenuFor('Summary');
    fireEvent.click(screen.getByTestId('table-move-left'));

    expect(headerLabels()).toEqual(['Issue type', 'Summary', 'Issue key']);
    expect(tableObs.tableColumnsObs.get().map((e: any) => e.sourceId)).toEqual([
      'identity:issueType',
      'identity:summary',
      'identity:key',
    ]);
  });

  test('"Move left" is disabled on the first column and "Move right" on the last', () => {
    renderReport(issues);

    openMenuFor('Issue type');
    expect(screen.getByTestId('table-move-left')).toBeDisabled();
    // Toggle the first menu closed so its portalled content doesn't collide with the next query.
    openMenuFor('Issue type');

    openMenuFor('Summary');
    expect(screen.getByTestId('table-move-right')).toBeDisabled();
  });

  test('each header exposes a drag handle and a data-column-id for pointer/drop targeting', () => {
    const { container } = renderReport(issues);
    const handles = screen.getAllByTestId('table-header-drag-handle');
    expect(handles.length).toBe(3);
    handles.forEach((h) => expect(h).toHaveAttribute('draggable', 'true'));
    const columnIds = Array.from(container.querySelectorAll('thead th')).map((th) => th.getAttribute('data-column-id'));
    expect(columnIds).toEqual(['identity:issueType', 'identity:key', 'identity:summary']);
  });
});

describe('TableReport (sticky headers / frozen label columns)', () => {
  const issues = [makeIssue('AAA-2', 'Beta task'), makeIssue('AAA-1', 'Alpha task')];

  const make2D = (key: string, status: string, priority: string, points: number) =>
    ({
      key,
      summary: `${key} summary`,
      url: `https://example.test/${key}`,
      hierarchyLevel: 1,
      parentKey: null,
      status,
      derivedTiming: {},
      issue: { fields: { 'Issue Type': { iconUrl: '' }, Status: status, Priority: priority, 'Story Points': points } },
    }) as any;
  const twoDIssues = [make2D('AAA-1', 'Done', 'High', 3), make2D('AAA-2', 'To Do', 'Low', 5)];
  const setup2D = () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('builtin:status:name');
    tableObs.tableGroupByColObs.set('field:priority');
    return { ...renderReport(twoDIssues, tableObs), tableObs };
  };

  test('flat table: every header cell sticks to the top; the first column header is the corner (top + left)', () => {
    const { container } = renderReport(issues);
    const headerCells = Array.from(container.querySelectorAll('thead th')) as HTMLElement[];
    expect(headerCells.length).toBeGreaterThan(1);
    headerCells.forEach((th) => {
      expect(th.style.position).toBe('sticky');
      expect(th.style.top).toBe('0px');
    });
    // First (row-label) column header also freezes on horizontal scroll.
    expect(headerCells[0].style.left).toBe('0px');
    // Non-first headers do NOT freeze left.
    expect(headerCells[1].style.left).toBe('');
    // Opaque background so scrolled content doesn't bleed through.
    expect(headerCells[0].style.background).not.toBe('');
  });

  test('flat table: the first body cell of each row freezes to the left', () => {
    const { container } = renderReport(issues);
    const firstBodyRow = container.querySelector('tbody tr') as HTMLElement;
    const firstCell = firstBodyRow.querySelector('td') as HTMLElement;
    expect(firstCell.style.position).toBe('sticky');
    expect(firstCell.style.left).toBe('0px');
    expect(firstCell.style.background).not.toBe('');
  });

  test('2D Down rows: the row-label AND Field header cells are frozen corners; body row-label freezes', () => {
    const { container } = setup2D();
    const table = screen.getByTestId('table-crosstab');
    expect(table.getAttribute('data-field-axis')).toBe('rows');
    const rowLabel = screen.getByTestId('table-crosstab-row-label');
    expect(rowLabel.style.position).toBe('sticky');
    expect(rowLabel.style.top).toBe('0px');
    expect(rowLabel.style.left).toBe('0px');
    // The "Field" (measure-name) column is the second frozen column, offset by the first's width.
    const fieldHeader = within(table).getByText('Field');
    expect(fieldHeader.style.position).toBe('sticky');
    expect(fieldHeader.style.top).toBe('0px');
    expect(parseInt(fieldHeader.style.left, 10)).toBeGreaterThan(0);
    // Body row-label cell (first td of the first body row) freezes left.
    const bodyRowLabel = container.querySelector('tbody tr td') as HTMLElement;
    expect(bodyRowLabel.style.position).toBe('sticky');
    expect(bodyRowLabel.style.left).toBe('0px');
  });

  test('2D Across cols: both header rows stay visible — row 2 sticks below row 1 (top offset > 0)', () => {
    const { tableObs } = setup2D();
    act(() => tableObs.tableFieldAxisObs.set('cols'));
    const table = screen.getByTestId('table-crosstab');
    expect(table.getAttribute('data-field-axis')).toBe('cols');
    const headerRows = Array.from(table.querySelectorAll('thead tr')) as HTMLElement[];
    expect(headerRows.length).toBe(2);
    // Row 1 (column-value blocks) sticks at the very top.
    const row1Cells = Array.from(headerRows[0].querySelectorAll('th')) as HTMLElement[];
    row1Cells.forEach((th) => expect(th.style.position).toBe('sticky'));
    // The corner (row-label) freezes both directions.
    const corner = screen.getByTestId('table-crosstab-row-label');
    expect(corner.style.top).toBe('0px');
    expect(corner.style.left).toBe('0px');
    // Row 2 (measure sub-headers) sticks BELOW row 1.
    const row2Cells = Array.from(headerRows[1].querySelectorAll('th')) as HTMLElement[];
    expect(row2Cells.length).toBeGreaterThan(0);
    row2Cells.forEach((th) => {
      expect(th.style.position).toBe('sticky');
      expect(parseInt(th.style.top, 10)).toBeGreaterThan(0);
    });
  });
});
