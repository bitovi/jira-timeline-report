import type { StoredNode } from '../../reports/ReportOfReports/model/sections';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReportLayoutProvider, useReportLayout } from './ReportLayoutProvider';
import { savedReportNode, toStoredSections } from '../../reports/ReportOfReports/model/sections';

const stored = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

const Editor = () => {
  const { sections, setSections, resetSections } = useReportLayout();

  return (
    <>
      <span data-testid="ids">{sections.map((node) => node.id).join(',')}</span>
      <span data-testid="stored">{JSON.stringify(toStoredSections(sections))}</span>
      <button onClick={() => setSections([...sections, savedReportNode('added')])}>add</button>
      <button onClick={resetSections}>reset</button>
    </>
  );
};

const Reader = () => {
  const { sections } = useReportLayout();

  return <span data-testid="count">{sections.length}</span>;
};

const renderProvider = (props: Partial<React.ComponentProps<typeof ReportLayoutProvider>> = {}) =>
  render(
    <ReportLayoutProvider {...props}>
      <Editor />
      <Reader />
    </ReportLayoutProvider>,
  );

const reportIds = () => screen.getByTestId('stored').textContent;

describe('<ReportLayoutProvider>', () => {
  // The document tree has to outlive any single subtree: SaveReports persists it and computes the
  // dirty flag, while the ReportOfReports body renders it — sibling subtrees under the shell.
  // See spec/016-report-of-reports.
  it('shares one tree across sibling subtrees', async () => {
    renderProvider();

    expect(screen.getByTestId('count')).toHaveTextContent('0');

    await userEvent.click(screen.getByRole('button', { name: 'add' }));

    expect(screen.getByTestId('count')).toHaveTextContent('1');
  });

  it('seeds from the saved report', () => {
    renderProvider({ savedReport: { id: 'doc', sections: [stored('a'), stored('b')] } });

    expect(screen.getByTestId('count')).toHaveTextContent('2');
  });

  it('tolerates a report saved with no sections at all', () => {
    renderProvider({ savedReport: { id: 'doc' } });

    expect(screen.getByTestId('count')).toHaveTextContent('0');
  });

  it('restores the saved tree on reset, discarding edits', async () => {
    renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

    await userEvent.click(screen.getByRole('button', { name: 'add' }));
    expect(reportIds()).toContain('added');

    await userEvent.click(screen.getByRole('button', { name: 'reset' }));

    expect(reportIds()).toBe(JSON.stringify([stored('a')]));
  });

  it('re-seeds when a different saved report is opened', () => {
    const { rerender } = render(
      <ReportLayoutProvider savedReport={{ id: 'one', sections: [stored('a')] }}>
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('1');

    rerender(
      <ReportLayoutProvider savedReport={{ id: 'two', sections: [stored('a'), stored('b'), stored('c')] }}>
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('3');
  });

  // routeData.reportsData is replaced on every reports fetch, so the record arrives as a fresh
  // object reference. Re-seeding on reference identity would throw away unsaved edits.
  it('keeps unsaved edits when an unchanged saved tree arrives as a new reference', async () => {
    const { rerender } = renderProvider({ savedReport: { id: 'one', sections: [stored('a')] } });

    await userEvent.click(screen.getByRole('button', { name: 'add' }));
    const idsBefore = screen.getByTestId('ids').textContent;

    rerender(
      <ReportLayoutProvider savedReport={{ id: 'one', sections: [stored('a')] }}>
        <Editor />
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('2');
    expect(screen.getByTestId('ids').textContent).toBe(idsBefore);
  });

  // After a save, the saved tree catches up to what's on screen. Re-parsing would mint new ids and
  // remount every child report — and a remounted child refetches from Jira.
  it('keeps node identity when the saved tree catches up after a save', async () => {
    const { rerender } = renderProvider({ savedReport: { id: 'one', sections: [stored('a')] } });

    await userEvent.click(screen.getByRole('button', { name: 'add' }));
    const idsBefore = screen.getByTestId('ids').textContent;

    rerender(
      <ReportLayoutProvider savedReport={{ id: 'one', sections: [stored('a'), stored('added')] }}>
        <Editor />
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('ids').textContent).toBe(idsBefore);
  });

  // Creating a report points the URL at a brand-new id, but `routeData.reportsData` only
  // repopulates on the next reports fetch — so for a moment the URL names a report no record
  // exists for yet. Re-seeding then would wipe the document the user just saved.
  it('keeps the document while the newly saved report has not loaded yet', async () => {
    const { rerender } = renderProvider({ savedReport: undefined });

    await userEvent.click(screen.getByRole('button', { name: 'add' }));
    const idsBefore = screen.getByTestId('ids').textContent;

    // Saved: the URL now names the new report, but its record hasn't arrived.
    rerender(
      <ReportLayoutProvider savedReport={undefined}>
        <Editor />
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('count')).toHaveTextContent('1');
    expect(screen.getByTestId('ids').textContent).toBe(idsBefore);

    // The refetch lands and the record matches what's on screen — still no remount.
    rerender(
      <ReportLayoutProvider savedReport={{ id: 'new-id', sections: [stored('added')] }}>
        <Editor />
        <Reader />
      </ReportLayoutProvider>,
    );

    expect(screen.getByTestId('ids').textContent).toBe(idsBefore);
  });

  it('fails loudly when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Reader />)).toThrow(/outside of its provider/);

    consoleError.mockRestore();
  });
});
