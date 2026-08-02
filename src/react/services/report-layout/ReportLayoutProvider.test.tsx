import type { StoredNode } from '../../reports/ReportOfReports/model/sections';

import React from 'react';
import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { ReportLayoutProvider, useReportLayout } from './ReportLayoutProvider';
import { savedReportNode, toStoredSections } from '../../reports/ReportOfReports/model/sections';
import { SECTIONS_PARAM } from '../../reports/ReportOfReports/model/documentParam';
import { pushStateObservable } from '../../../canjs/routing/state-storage';

const stored = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

/**
 * Rewrites the whole query string the way the app does — through the observable the provider
 * watches — and then notifies, which under vitest has to be done by hand.
 *
 * `PushstateObservable.onBound` bails out when `can-globals` reports Node (`typeof process ===
 * 'object'`, true under vitest), so it never installs the `history.pushState` wrapper that notifies
 * subscribers in a real browser. Writes still reach `window.location`; only the notification is
 * missing. `dispatchHandlers` in turn no-ops when its cached `_value` already matches the current
 * URL, and that cache is stale precisely because the provider's own writes bypassed it — hence the
 * clear.
 */
const setSearch = (search: string) => {
  pushStateObservable.value = search;

  const observable = pushStateObservable as unknown as { _value?: string; dispatchHandlers: () => void };

  observable._value = undefined;
  observable.dispatchHandlers();
};

const sectionsParam = () => new URLSearchParams(window.location.search).get(SECTIONS_PARAM);

const encoded = (...nodes: StoredNode[]) => JSON.stringify(nodes);

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
  // The provider writes the tree to the URL, so a leftover param would seed the next test.
  beforeEach(() => {
    setSearch('');
  });

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

  // spec/016-report-of-reports/006-url-state Phase 1. Every other report's settings are in the URL
  // from the first keystroke; these are what give a document the same refresh/bookmark/share.
  describe('the URL', () => {
    it('seeds from the sections param in preference to the saved report', () => {
      setSearch(`?report=doc&${SECTIONS_PARAM}=${encodeURIComponent(encoded(stored('url')))}`);

      renderProvider({ savedReport: { id: 'doc', sections: [stored('saved')] } });

      expect(reportIds()).toBe(encoded(stored('url')));
    });

    // The case with no `?report=` at all: a document built from scratch and refreshed. There is no
    // saved record to re-seed from, so the URL is the only thing that can carry it.
    it('seeds an unsaved document from the param', () => {
      setSearch(`?${SECTIONS_PARAM}=${encodeURIComponent(encoded(stored('a'), stored('b')))}`);

      renderProvider();

      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });

    it('still seeds from the saved report when the param is absent', () => {
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      expect(reportIds()).toBe(encoded(stored('a')));
      expect(sectionsParam()).toBeNull();
    });

    it('writes the param on an edit', async () => {
      setSearch('?report=doc');
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      await userEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(sectionsParam()).toBe(encoded(stored('a'), stored('added')));
      // The rest of the query string is untouched — this is one param among many.
      expect(new URLSearchParams(window.location.search).get('report')).toBe('doc');
    });

    // `paramsMatchReport` treats *any* leftover param as dirty, so a param that failed to delete
    // itself would leave the document permanently offering "Save report".
    it('deletes the param when an edit restores the saved tree', async () => {
      setSearch('?report=doc');
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a'), stored('added')] } });

      await userEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(sectionsParam()).not.toBeNull();

      await userEvent.click(screen.getByRole('button', { name: 'reset' }));

      expect(sectionsParam()).toBeNull();
      expect(window.location.search).toBe('?report=doc');
    });

    // Any non-empty tree diverges from a brand-new document's `[]` baseline.
    it('writes the param for a document with no saved report', async () => {
      renderProvider();

      await userEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(sectionsParam()).toBe(encoded(stored('added')));
    });

    it('adopts an external URL change — back/forward, or a reset', async () => {
      setSearch('?report=doc');
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      await userEvent.click(screen.getByRole('button', { name: 'add' }));
      expect(screen.getByTestId('count')).toHaveTextContent('2');

      // Back to the entry with no `sections` param: the document is what the report has saved.
      act(() => setSearch('?report=doc'));

      expect(reportIds()).toBe(encoded(stored('a')));
    });

    it('adopts a sections param that arrives from outside', async () => {
      setSearch('?report=doc');
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      act(() => setSearch(`?report=doc&${SECTIONS_PARAM}=${encodeURIComponent(encoded(stored('b')))}`));

      expect(reportIds()).toBe(encoded(stored('b')));
    });

    // The single thing most likely to go wrong: re-parsing the tree we just wrote would mint new
    // node ids, remount every ChildReport, and a remounted child refetches from Jira.
    it('ignores the tick caused by its own write, keeping node ids stable', async () => {
      setSearch('?report=doc');
      renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      const idsBefore = screen.getByTestId('ids').textContent;

      await userEvent.click(screen.getByRole('button', { name: 'add' }));

      expect(screen.getByTestId('ids').textContent).toMatch(new RegExp(`^${idsBefore},`));
    });

    // A `reportsData` refetch re-delivers the as-saved record. Before the URL held the tree that
    // was harmless; now it must not stomp the edits the URL is carrying.
    it('does not re-seed from the saved report while the param is present', async () => {
      setSearch('?report=doc');
      const { rerender } = renderProvider({ savedReport: { id: 'doc', sections: [stored('a')] } });

      await userEvent.click(screen.getByRole('button', { name: 'add' }));
      const idsBefore = screen.getByTestId('ids').textContent;

      rerender(
        <ReportLayoutProvider savedReport={{ id: 'doc', sections: [stored('a')] }}>
          <Editor />
          <Reader />
        </ReportLayoutProvider>,
      );

      expect(screen.getByTestId('ids').textContent).toBe(idsBefore);
      expect(screen.getByTestId('count')).toHaveTextContent('2');
    });
  });

  it('fails loudly when used outside the provider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => render(<Reader />)).toThrow(/outside of its provider/);

    consoleError.mockRestore();
  });
});
