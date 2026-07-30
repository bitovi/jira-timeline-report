import type { Reports } from '../../../../jira/reports';
import type { LayoutNode, StoredNode } from '../../../reports/ReportOfReports/model/sections';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { useSelectedReport } from './useSelectedReport';
import { savedReportNode, parseSections } from '../../../reports/ReportOfReports/model/sections';

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
    window.history.replaceState({}, '', '?report=doc');
  });

  it('selects the report named in the URL', () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a')])} />);

    expect(screen.getByTestId('selected')).toHaveTextContent('doc');
  });

  // Layout edits live outside the URL, so paramsMatchReport can't see them. Without this the
  // "Save report" button would never appear for a report-of-reports.
  it('is dirty when the in-memory tree differs from the saved one', () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a'), stored('b')])} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('true');
  });

  it('is not dirty when the tree matches what was saved', () => {
    render(<Harness reports={docReport([stored('a')])} sections={parseSections([stored('a')])} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');
  });

  it('ignores node ids when comparing', () => {
    render(<Harness reports={docReport([stored('a')])} sections={[savedReportNode('a')]} />);

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

  // Saving writes the updated map into the query cache, so `reports` refreshes on the next render.
  // Holding `selectedReport` in state meant the comparison kept running against the pre-save record
  // and "Save report" never went away.
  it('clears the dirty flag once the saved report reflects the save', () => {
    const sections = parseSections([stored('a'), stored('b')]);

    const { rerender } = render(<Harness reports={docReport([stored('a')])} sections={sections} />);
    expect(screen.getByTestId('dirty')).toHaveTextContent('true');

    rerender(<Harness reports={docReport([stored('a'), stored('b')])} sections={sections} />);

    expect(screen.getByTestId('dirty')).toHaveTextContent('false');
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
