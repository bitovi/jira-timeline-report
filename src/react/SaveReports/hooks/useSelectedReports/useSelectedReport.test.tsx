import type { Reports } from '../../../../jira/reports';
import type { LayoutNode, StoredNode } from '../../../reports/ReportOfReports/model/sections';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSelectedReport } from './useSelectedReport';
import { parseSections } from '../../../reports/ReportOfReports/model/sections';

const stored = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

const updates: Array<{ id: string; updates: any }> = [];

vi.mock('../../../services/reports', () => ({
  useUpdateReport: () => ({
    updateReport: (id: string, reportUpdates: any, options?: any) => {
      updates.push({ id, updates: reportUpdates });
      options?.onSuccess?.();
    },
  }),
}));

vi.mock('../../../../canjs/routing/route-data', () => ({
  default: {
    serialize: () => ({ primaryReportType: 'report-of-reports', jql: '', roundTo: 'day' }),
  },
}));

const queryParamObservable = { value: '?report=doc', set: vi.fn(), on: vi.fn(), off: vi.fn() } as any;

/** The hook reads the URL directly on mount and the observable thereafter, so both have to move. */
const setSearch = (search: string) => {
  window.history.replaceState({}, '', search);
  queryParamObservable.value = search;
};

const Harness = ({ reports, sections }: { reports: Reports; sections: LayoutNode[] }) => {
  const { selectedReport, isDirty, updateSelectedReport } = useSelectedReport({
    reports,
    queryParamObservable,
    sections,
  });

  return (
    <>
      <span data-testid="selected">{selectedReport?.id ?? 'none'}</span>
      <span data-testid="dirty">{String(isDirty)}</span>
      <button onClick={updateSelectedReport}>save</button>
    </>
  );
};

const docReport = (sections?: StoredNode[]) => ({
  doc: { id: 'doc', name: 'Doc', queryParams: 'primaryReportType=report-of-reports&report=doc', sections },
});

describe('useSelectedReport', () => {
  beforeEach(() => {
    updates.length = 0;
    queryParamObservable.set.mockClear();
    setSearch('?report=doc');
  });

  it('selects the report named in the URL', () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a')])} />);

    expect(screen.getByTestId('selected')).toHaveTextContent('doc');
  });

  // A document's layout edits are a `sections` URL param now
  // (spec/016-report-of-reports/006-url-state Phase 1), so the one dirty signal every other report
  // uses covers them too — this hook no longer compares trees at all.
  it('is dirty when the URL carries a sections param', () => {
    setSearch('?report=doc&sections=%5B%5D');

    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a'), stored('b')])} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  });

  it('is not dirty at a clean ?report=<id>, whatever the in-memory tree', () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a'), stored('b')])} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');
  });

  // Backward compatibility: a report saved before `sections` existed must not look dirty on load.
  it('is not dirty for a report with no saved sections and an empty tree', () => {
    render(<Harness reports={docReport(undefined)} sections={[]} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');
  });

  it('persists the tree on save', async () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a'), stored('b')])} />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updates).toHaveLength(1);
    expect(updates[0].id).toBe('doc');
    expect(updates[0].updates.sections).toEqual([stored('a'), stored('b')]);
  });

  it('clears the dirty flag on a successful save', async () => {
    setSearch('?report=doc&sections=%5B%5D');

    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a'), stored('b')])} />);
    expect(screen.getByTestId('dirty')).toHaveTextContent('true');

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');
    // ...and the URL is reset to the saved report, which clears the `sections` param with it.
    expect(queryParamObservable.set).toHaveBeenCalledWith('?report=doc');
  });

  // Overrides are node params, so the existing save path carries them with no change to it — but
  // "no change needed" is exactly the sort of claim that stops being true silently.
  // See spec/016-report-of-reports/006-url-state Phase 3.
  it('persists a child report override with the tree', async () => {
    const tweaked = parseSections([
      { type: 'saved-report', params: { reportId: 'a', overrides: 'tableSortDir=desc' } },
    ]);

    render(<Harness reports={docReport([stored('a')])} sections={tweaked} />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updates[0].updates.sections).toEqual([
      { type: 'saved-report', params: { reportId: 'a', overrides: 'tableSortDir=desc' } },
    ]);
  });

  // Every other report type has an empty tree. Writing `sections: []` onto all of them would add
  // dead weight to the storage blob that all app data shares.
  it('leaves sections off a report that has none', async () => {
    render(<Harness reports={docReport(undefined)} sections={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updates[0].updates).not.toHaveProperty('sections');
  });

  // ...but a document whose last node was removed must clear the saved tree, not keep it.
  it('writes an empty tree when the report has a saved one', async () => {
    render(<Harness reports={docReport([stored('a')])} sections={[]} />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updates[0].updates.sections).toEqual([]);
  });

  it('stores only the report type in queryParams for a report-of-reports', async () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a')])} />);

    await userEvent.click(screen.getByRole('button', { name: 'save' }));

    expect(updates[0].updates.queryParams).toBe('primaryReportType=report-of-reports');
  });
});
