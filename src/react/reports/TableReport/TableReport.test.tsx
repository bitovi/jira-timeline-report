import React from 'react';
import { describe, test, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within, act } from '@testing-library/react';

import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { IssueFields } from './model/buildColumnCatalog';

// Mock the Jira fields hook so the report renders without a QueryClient/JiraProvider or Suspense
// backend. The catalog is derived purely from these fields.
const mockFields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Priority', key: 'priority', schema: { type: 'string' }, id: 'priority', custom: false },
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
  tableFieldAxisObs: obs('rows'),
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
    tableObs.tableGroupByObs.set('field:status');
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

    // The Done group's Story Points measure defaults to Sum = 3 + 2 = 5.
    const doneHeader = headers.find((h) => h.textContent?.includes('Done'))!;
    expect(within(doneHeader).getByTestId('table-group-measure').textContent).toBe('5');
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

  // rows = Status {Done, To Do}; cols = Priority {High, Low}. Story Points is the sole measure.
  const twoDIssues = [
    make2D('AAA-1', 'Done', 'High', 3),
    make2D('AAA-2', 'To Do', 'Low', 5),
    make2D('AAA-3', 'Done', 'High', 2),
  ];

  /** Seed: Story Points shown, grouped by Status (rows) with Priority as the 2D column dimension. */
  const setup2D = () => {
    const tableObs = makeTableObs();
    tableObs.tableColumnsObs.set([...DEFAULT_COLUMNS, { sourceId: 'field:customfield_1' }]);
    tableObs.tableGroupByObs.set('field:status');
    tableObs.tableGroupByColObs.set('field:priority');
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
    const doneCells = within(doneRow).getAllByTestId('table-crosstab-cell').map((c) => c.textContent);
    // [High, Low, Total] → 5, · (empty), 5.
    expect(doneCells).toEqual(['5', '·', '5']);

    // Grand total row aggregates down the row axis: High col total = 5, Low = 5, grand = 10.
    const totalRow = within(table).getByTestId('table-crosstab-total-row');
    expect(within(totalRow).getAllByTestId('table-crosstab-cell').map((c) => c.textContent)).toEqual(['5', '5', '10']);
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
    const doneRow = within(table).getAllByTestId('table-crosstab-row').find((r) => r.textContent?.includes('Done'))!;
    expect(within(doneRow).getAllByTestId('table-crosstab-cell')[0].textContent).toBe('5');
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
    const summaryHeader = screen
      .getAllByTestId('table-header-sort')
      .find((b) => b.textContent?.startsWith('Summary'))!;
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
    tableObs.tableGroupByObs.set('field:status');
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
