import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

import type { IssueFields } from '../model/buildColumnCatalog';

// The catalog is derived purely from these fields.
const mockFields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Priority', key: 'priority', schema: { type: 'string' }, id: 'priority', custom: false },
  { name: 'Due Date', key: 'duedate', schema: { type: 'date' }, id: 'duedate', custom: false },
];
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => mockFields,
}));

// Back the route-data hook with a mutable store so we can seed values and observe write-backs
// without wiring the real can route-data.
let store: Record<string, any>;
vi.mock('../../../hooks/useRouteData', () => ({
  useRouteData: (key: string) => [
    store[key],
    (v: any) => {
      store[key] = v;
    },
  ],
}));

import { TableReportControls } from './TableReportControls';

beforeEach(() => {
  store = {
    tableColumns: [{ sourceId: 'identity:issueType' }, { sourceId: 'identity:key' }, { sourceId: 'identity:summary' }],
    tableSortColumn: '',
    tableSortDir: 'asc',
    tableGroupBy: '',
    tableGroupByCol: '',
    tableGroupByGranularity: '',
    tableGroupByColGranularity: '',
    tableFieldAxis: 'rows',
    tableShowRowTotals: false,
    tableShowColTotals: false,
  };
});
afterEach(() => cleanup());

describe('<TableReportControls />', () => {
  test('renders the Group by and Add column controls (no global Rows control)', () => {
    render(<TableReportControls />);
    // Row ordering now lives on the tree column's sort, so there is no Rows control here.
    expect(screen.queryByTestId('table-row-ordering--trigger')).not.toBeInTheDocument();
    expect(screen.getByTestId('table-group-by--trigger')).toBeInTheDocument();
    expect(screen.getByTestId('table-add-column')).toBeInTheDocument();
  });

  test('Group by lists only the added (non-identity) columns, not the whole catalog (#1)', () => {
    // Add two field columns; Priority stays unadded and must NOT appear as a group option.
    store.tableColumns = [
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
      { sourceId: 'builtin:status:name' },
      { sourceId: 'field:customfield_1' },
    ];
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    expect(screen.getByText('Status')).toBeInTheDocument();
    expect(screen.getByText('Story Points')).toBeInTheDocument();
    expect(screen.queryByText('Priority')).not.toBeInTheDocument();
  });

  test('choosing a group writes back to tableGroupBy and clears an active Hierarchy sort', () => {
    // A tree (Hierarchy) sort is active; grouping is mutually exclusive with it, so it must clear.
    store.tableSortColumn = 'identity:summary';
    store.tableSortDir = 'tree';
    // Status must be an added column to be offered as a group option (#1).
    store.tableColumns = [{ sourceId: 'identity:key' }, { sourceId: 'builtin:status:name' }];
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    fireEvent.click(screen.getByText('Status'));
    expect(store.tableGroupBy).toBe('builtin:status:name');
    expect(store.tableSortColumn).toBe('');
    expect(store.tableSortDir).toBe('asc');
  });

  test('adding a column appends it to tableColumns (which drives the field fetch — see route-data #2)', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-add-column'));
    // The raw "Story Points" field lives under the "Fields" section — disambiguate it from the
    // canonical "Report Fields" facet of the same label (both are offered by design, see
    // spec/012-table-and-grouper/common-and-report-field-columns.md).
    const popover = screen.getByTestId('table-add-column-popover');
    const fieldsSection = within(popover).getByText('Fields').closest('div') as HTMLElement;
    fireEvent.click(within(fieldsSection).getByText('Story Points'));
    expect((store.tableColumns as any[]).map((c) => c.sourceId)).toContain('field:customfield_1');
  });
});

describe('<TableReportControls /> date-bucket grouping (spec/012-table-and-grouper/date-bucket-grouping.md)', () => {
  beforeEach(() => {
    store.tableColumns = [{ sourceId: 'identity:key' }, { sourceId: 'field:duedate' }];
  });

  test('a date column in Group by opens a granularity submenu instead of selecting directly', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    // Clicking the date column's row opens ITS submenu rather than writing tableGroupBy immediately.
    fireEvent.click(screen.getByText('Due Date'));
    expect(store.tableGroupBy).toBe('');
    expect(screen.getByText('Month')).toBeInTheDocument();
    expect(screen.getByText('Quarter')).toBeInTheDocument();
  });

  test('choosing a granularity writes back both tableGroupBy and tableGroupByGranularity', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    fireEvent.click(screen.getByText('Due Date'));
    fireEvent.click(screen.getByText('Quarter'));
    expect(store.tableGroupBy).toBe('field:duedate');
    expect(store.tableGroupByGranularity).toBe('quarter');
  });

  test('the Group by trigger shows the column label with its granularity', () => {
    store.tableGroupBy = 'field:duedate';
    store.tableGroupByGranularity = 'month';
    render(<TableReportControls />);
    expect(screen.getByTestId('table-group-by--trigger')).toHaveTextContent('Due Date (Month)');
  });

  test('a non-date column in Group by still selects directly (no submenu)', () => {
    store.tableColumns = [{ sourceId: 'identity:key' }, { sourceId: 'builtin:status:name' }];
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    fireEvent.click(screen.getByText('Status'));
    expect(store.tableGroupBy).toBe('builtin:status:name');
    expect(store.tableGroupByGranularity).toBe('');
  });
});

describe('<TableReportControls /> Fields axis (2D cross-tab)', () => {
  test('offers "Hidden" alongside Down rows/Across cols when only one measure is shown', () => {
    // Grouped by Status (rows) x Priority (cols); Story Points is the sole remaining measure (the
    // grouped fields themselves don't need to be in the shown-column list to drive the cross-tab).
    store.tableColumns = [{ sourceId: 'field:customfield_1' }];
    store.tableGroupBy = 'builtin:status:name';
    store.tableGroupByCol = 'field:priority';
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-field-axis--trigger'));
    expect(screen.getByTestId('table-field-axis-hidden')).toBeInTheDocument();
  });

  test('omits "Hidden" when more than one measure is shown', () => {
    // Identity columns are eligible measures too, so shown Key + Story Points = two measures.
    store.tableColumns = [{ sourceId: 'identity:key' }, { sourceId: 'field:customfield_1' }];
    store.tableGroupBy = 'builtin:status:name';
    store.tableGroupByCol = 'field:priority';
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-field-axis--trigger'));
    expect(screen.queryByTestId('table-field-axis-hidden')).not.toBeInTheDocument();
  });

  test('choosing "Hidden" writes tableFieldAxis', () => {
    store.tableColumns = [{ sourceId: 'field:customfield_1' }];
    store.tableGroupBy = 'builtin:status:name';
    store.tableGroupByCol = 'field:priority';
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-field-axis--trigger'));
    fireEvent.click(screen.getByTestId('table-field-axis-hidden'));
    expect(store.tableFieldAxis).toBe('hidden');
  });
});

describe('<TableReportControls /> Totals (2D cross-tab)', () => {
  beforeEach(() => {
    store.tableColumns = [{ sourceId: 'field:customfield_1' }];
    store.tableGroupBy = 'builtin:status:name';
    store.tableGroupByCol = 'field:priority';
  });

  test('is not rendered when not 2D-grouped', () => {
    store.tableGroupByCol = '';
    render(<TableReportControls />);
    expect(screen.queryByTestId('table-totals--trigger')).not.toBeInTheDocument();
  });

  test('trigger reads "None" when neither total is on (the default)', () => {
    render(<TableReportControls />);
    expect(screen.getByTestId('table-totals--trigger')).toHaveTextContent('None');
  });

  test('trigger reads "Rows", "Columns", or "Both" depending on which are checked', () => {
    store.tableShowRowTotals = true;
    render(<TableReportControls />);
    expect(screen.getByTestId('table-totals--trigger')).toHaveTextContent('Rows');
    cleanup();

    store.tableShowRowTotals = false;
    store.tableShowColTotals = true;
    render(<TableReportControls />);
    expect(screen.getByTestId('table-totals--trigger')).toHaveTextContent('Columns');
    cleanup();

    store.tableShowRowTotals = true;
    store.tableShowColTotals = true;
    render(<TableReportControls />);
    expect(screen.getByTestId('table-totals--trigger')).toHaveTextContent('Both');
  });

  test('checking "Row totals" writes tableShowRowTotals without touching tableShowColTotals', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-totals--trigger'));
    fireEvent.click(screen.getByTestId('table-totals-row'));
    expect(store.tableShowRowTotals).toBe(true);
    expect(store.tableShowColTotals).toBe(false);
  });

  test('checking "Column totals" writes tableShowColTotals without touching tableShowRowTotals', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-totals--trigger'));
    fireEvent.click(screen.getByTestId('table-totals-col'));
    expect(store.tableShowColTotals).toBe(true);
    expect(store.tableShowRowTotals).toBe(false);
  });

  test('unchecking an already-on total toggles it back off', () => {
    store.tableShowRowTotals = true;
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-totals--trigger'));
    fireEvent.click(screen.getByTestId('table-totals-row'));
    expect(store.tableShowRowTotals).toBe(false);
  });
});
