import React from 'react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';

import type { IssueFields } from '../model/buildColumnCatalog';

// The catalog is derived purely from these fields.
const mockFields: IssueFields = [
  { name: 'Story Points', key: 'customfield_1', schema: { type: 'number' }, id: 'customfield_1', custom: true },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Priority', key: 'priority', schema: { type: 'string' }, id: 'priority', custom: false },
];
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => mockFields,
}));

// Back the route-data hook with a mutable store so we can seed values and observe write-backs
// without wiring the real can route-data.
let store: Record<string, any>;
vi.mock('../../../hooks/useRouteData', () => ({
  useRouteData: (key: string) => [store[key], (v: any) => { store[key] = v; }],
}));

import { TableReportControls } from './TableReportControls';

beforeEach(() => {
  store = {
    tableColumns: [
      { sourceId: 'identity:issueType' },
      { sourceId: 'identity:key' },
      { sourceId: 'identity:summary' },
    ],
    tableSortColumn: '',
    tableSortDir: 'asc',
    tableGroupBy: '',
    tableGroupByCol: '',
    tableFieldAxis: 'rows',
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
      { sourceId: 'field:status' },
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
    store.tableColumns = [{ sourceId: 'identity:key' }, { sourceId: 'field:status' }];
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-group-by--trigger'));
    fireEvent.click(screen.getByText('Status'));
    expect(store.tableGroupBy).toBe('field:status');
    expect(store.tableSortColumn).toBe('');
    expect(store.tableSortDir).toBe('asc');
  });

  test('adding a column appends it to tableColumns (which drives the field fetch — see route-data #2)', () => {
    render(<TableReportControls />);
    fireEvent.click(screen.getByTestId('table-add-column'));
    fireEvent.click(within(screen.getByTestId('table-add-column-popover')).getByText('Story Points'));
    expect((store.tableColumns as any[]).map((c) => c.sourceId)).toContain('field:customfield_1');
  });
});
