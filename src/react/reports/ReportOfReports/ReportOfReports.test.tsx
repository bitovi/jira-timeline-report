import type { AppStorage } from '../../../jira/storage/common';
import type { StoredNode } from './model/sections';
import type { ComponentProps } from 'react';

import React, { Suspense } from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { ObservableObject, value } from '../../../can';
import { ReportOfReports } from './ReportOfReports';
import { StorageProvider } from '../../services/storage';
import { ReportLayoutProvider } from '../../services/report-layout';
import { useCanObservable } from '../../hooks/useCanObservable';

const savedReports = {
  a: { id: 'a', name: 'Alpha', queryParams: 'jql=project%3DA&primaryReportType=start-due&roundTo=month' },
  b: { id: 'b', name: 'Beta', queryParams: 'jql=project%3DB&primaryReportType=due&roundTo=week' },
  c: { id: 'c', name: 'Gamma', queryParams: 'jql=project%3DC&primaryReportType=start-due' },
};

const stored = (reportId: string): StoredNode => ({ type: 'saved-report', params: { reportId } });

/** One entry per ChildReport mount — a remount means the child refetches from Jira. */
const mounts: string[] = [];

/** Stands in for a real report, showing a value from the prop bag its own child config produced. */
const Probe = ({ roundToObs }: any) => {
  const roundTo = useCanObservable<string>(roundToObs);

  React.useEffect(() => {
    mounts.push(roundTo);
  }, []);

  return <span data-testid="child-report">{roundTo}</span>;
};

// can.js has loose (.js) types — ObservableObject's declaration exposes no static props hook.
const ObservableObjectClass = ObservableObject as any;

class FakeParent extends ObservableObjectClass {
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

const makeParent = () => {
  const parent = new FakeParent() as any;

  parent.isLoggedInObservable = (value as any).with(true);
  parent.jiraHelpers = {
    fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields: () => new Promise(() => {}),
    fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields: () => new Promise(() => {}),
  };

  return parent;
};

const childReportProps = {
  parent: makeParent(),
  components: { 'start-due': Probe, due: Probe },
  useLoadingState: () => ({ status: 'resolved' as const }),
};

const storage = {
  get: async () => savedReports,
  update: async () => {},
  storageInitialized: async () => true,
} as unknown as ComponentProps<typeof StorageProvider>['storage'];

const renderReport = (
  { savedSections, currentReportId }: { savedSections?: StoredNode[]; currentReportId?: string } = {},
  storageOverride: AppStorage = storage,
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <Suspense fallback="loading">
      <StorageProvider storage={storageOverride as ComponentProps<typeof StorageProvider>['storage']}>
        <QueryClientProvider client={queryClient}>
          <ReportLayoutProvider savedReport={{ id: 'doc', sections: savedSections }}>
            <ReportOfReports currentReportId={currentReportId} childReportProps={childReportProps} />
          </ReportLayoutProvider>
        </QueryClientProvider>
      </StorageProvider>
    </Suspense>,
  );
};

const addReport = async (name: string) => {
  await userEvent.click(await screen.findByRole('button', { name: 'Add Report' }));
  await userEvent.click(await screen.findByRole('button', { name }));
};

const cardNames = () => screen.getAllByTestId('report-card').map((card) => card.getAttribute('data-report-name'));

const clickControl = async (name: string) => userEvent.click(await screen.findByRole('button', { name }));

/**
 * A section's title, as the button that opens its field. InlineEdit names that button
 * "<title>, edit" — the phrasing a screen reader reads out — so the suffix is expected, not a typo.
 */
const sectionTitle = (title: string) => screen.findByRole('button', { name: `${title}, edit` });

const retitleSection = async (from: string, to: string) => {
  await userEvent.click(await sectionTitle(from));
  await userEvent.clear(await screen.findByRole('textbox'));
  await userEvent.type(screen.getByRole('textbox'), to);
  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
};

// Each card hosts a real ChildReport, which builds its own config and prop bag from the embedded
// report's saved queryParams. See spec/016-report-of-reports.
describe('<ReportOfReports>', () => {
  beforeEach(() => {
    mounts.length = 0;
  });

  it('renders an Add Report button as its empty state', async () => {
    renderReport();

    expect(await screen.findByRole('button', { name: 'Add Report' })).toBeInTheDocument();
    expect(screen.queryAllByTestId('report-card')).toHaveLength(0);
  });

  it('adds the chosen report and keeps the Add Report button below it', async () => {
    renderReport();

    await addReport('Beta');

    const [card] = screen.getAllByTestId('report-card');
    const button = screen.getByRole('button', { name: 'Add Report' });

    expect(card).toHaveTextContent('Beta');
    // Node.DOCUMENT_POSITION_FOLLOWING — the button comes after the card in document order.
    expect(card.compareDocumentPosition(button) & 4).toBeTruthy();
  });

  it('adds several reports and keeps them in the order they were added', async () => {
    renderReport();

    await addReport('Gamma');
    await addReport('Alpha');
    await addReport('Beta');

    expect(cardNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
  });

  it('renders each child report with its own config', async () => {
    renderReport();

    await addReport('Alpha');
    await addReport('Beta');

    expect(screen.getAllByTestId('child-report').map((node) => node.textContent)).toEqual(['month', 'week']);
  });

  it('renders the same report twice as two distinct cards', async () => {
    renderReport();

    await addReport('Alpha');
    await addReport('Alpha');

    expect(screen.getAllByTestId('report-card')).toHaveLength(2);
  });

  it('excludes the report currently open, so a document cannot embed itself', async () => {
    renderReport({ currentReportId: 'b' });

    await userEvent.click(await screen.findByRole('button', { name: 'Add Report' }));

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
  });

  it('renders a placeholder for a node type it does not recognize instead of crashing', async () => {
    renderReport({
      savedSections: [
        { type: 'inline-report', params: { expression: '(issue = IMP-1).summary' } } as unknown as StoredNode,
      ],
    });

    expect(await screen.findByTestId('report-card')).toHaveTextContent(/inline-report/);
    expect(screen.getByRole('button', { name: 'Add Report' })).toBeInTheDocument();
  });

  // See spec/016-report-of-reports Phase 4.
  describe('editing the document', () => {
    const threeReports = [stored('c'), stored('a'), stored('b')];

    it('removes the chosen card and leaves the rest in order', async () => {
      renderReport({ savedSections: threeReports });

      await clickControl('Remove Alpha');

      expect(cardNames()).toEqual(['Gamma', 'Beta']);
    });

    it('moves a card up and down among its siblings', async () => {
      renderReport({ savedSections: threeReports });

      await clickControl('Move Alpha up');
      expect(cardNames()).toEqual(['Alpha', 'Gamma', 'Beta']);

      await clickControl('Move Alpha down');
      expect(cardNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
    });

    it('disables the moves that would take a card past either end', async () => {
      renderReport({ savedSections: threeReports });

      expect(await screen.findByRole('button', { name: 'Move Gamma up' })).toBeDisabled();
      expect(screen.getByRole('button', { name: 'Move Gamma down' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Move Beta up' })).toBeEnabled();
      expect(screen.getByRole('button', { name: 'Move Beta down' })).toBeDisabled();
    });

    // Reordering must not remount the children it moves — a remounted ChildReport refetches from
    // Jira. Node ids exist for exactly this reason; keying on position would break it.
    it('reorders without remounting the children', async () => {
      renderReport({ savedSections: [stored('a'), stored('b')] });

      expect(await screen.findByRole('button', { name: 'Move Beta up' })).toBeInTheDocument();
      expect(mounts).toEqual(['month', 'week']);

      await clickControl('Move Beta up');

      expect(cardNames()).toEqual(['Beta', 'Alpha']);
      expect(mounts).toEqual(['month', 'week']);
    });

    it('controls a section and its children independently', async () => {
      const section: StoredNode = { type: 'section', params: { title: 'Q3' }, children: [stored('a'), stored('b')] };
      renderReport({ savedSections: [section, stored('c')] });

      // A child moves within its own section only, so Beta's "down" is blocked by the section's end.
      expect(await screen.findByRole('button', { name: 'Move Beta down' })).toBeDisabled();

      await clickControl('Move Beta up');
      expect(cardNames()).toEqual(['Beta', 'Alpha', 'Gamma']);

      await clickControl('Move Q3 down');
      expect(cardNames()).toEqual(['Gamma', 'Beta', 'Alpha']);
    });
  });

  // See spec/016-report-of-reports/002-nested-sections.
  describe('section titles', () => {
    const withSection = (title: string): StoredNode[] => [
      { type: 'section', params: { title }, children: [stored('a')] },
    ];

    it('opens the title field when the title is clicked, focused and ready to type', async () => {
      renderReport({ savedSections: withSection('Q3') });

      await userEvent.click(await sectionTitle('Q3'));

      expect(await screen.findByRole('textbox')).toHaveFocus();
    });

    it('renders the confirmed title', async () => {
      renderReport({ savedSections: withSection('Q3') });

      await retitleSection('Q3', 'Q4 Planning');

      expect(await screen.findByRole('heading', { name: 'Q4 Planning' })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Q3' })).not.toBeInTheDocument();
    });

    it('leaves the title alone when the edit is cancelled', async () => {
      renderReport({ savedSections: withSection('Q3') });

      await userEvent.click(await sectionTitle('Q3'));
      await userEvent.type(await screen.findByRole('textbox'), 'ignored');
      await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(await screen.findByRole('heading', { name: 'Q3' })).toBeInTheDocument();
    });

    // A section with no title still needs something to click, or it can never be named.
    it('gives an untitled section a placeholder heading that opens the field', async () => {
      renderReport({ savedSections: withSection('') });

      await userEvent.click(await sectionTitle('Untitled section'));

      expect(await screen.findByRole('textbox')).toBeInTheDocument();
    });

    // Retitling must not remount what's inside the section — a remounted ChildReport refetches.
    it('does not remount the section children', async () => {
      renderReport({ savedSections: withSection('Q3') });

      expect(await sectionTitle('Q3')).toBeInTheDocument();
      expect(mounts).toEqual(['month']);

      await retitleSection('Q3', 'Q4');

      expect(await screen.findByRole('heading', { name: 'Q4' })).toBeInTheDocument();
      expect(mounts).toEqual(['month']);
    });
  });

  describe('adding sections', () => {
    const addSection = async (name = 'Add Section') => userEvent.click(await screen.findByRole('button', { name }));

    /** The `<section>` wrapping a titled section, so containment can be asserted rather than order. */
    const sectionFor = async (title: string) => (await sectionTitle(title)).closest('section') as HTMLElement;

    it('offers Add Section beside Add Report on an empty document', async () => {
      renderReport();

      const add = await screen.findByRole('button', { name: 'Add Report' });
      const section = screen.getByRole('button', { name: 'Add Section' });

      expect(section).toBeInTheDocument();
      // Node.DOCUMENT_POSITION_FOLLOWING — the two sit together, section second.
      expect(add.compareDocumentPosition(section) & 4).toBeTruthy();
    });

    it('adds a section with its title field already focused', async () => {
      renderReport();

      await addSection();

      expect(await screen.findByRole('textbox')).toHaveFocus();
    });

    it('names a section it just added', async () => {
      renderReport();

      await addSection();
      await userEvent.type(await screen.findByRole('textbox'), 'Q3 Planning');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await screen.findByRole('heading', { name: 'Q3 Planning' })).toBeInTheDocument();
    });

    it('puts a report added from a section inside that section', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [] }, stored('c')] });

      await userEvent.click(await screen.findByRole('button', { name: 'Add Report to Q3' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Alpha' }));

      const section = await sectionFor('Q3');

      expect(within(section).getByTestId('report-card')).toHaveTextContent('Alpha');
      // Gamma is a sibling of the section, not a child of it.
      expect(within(section).queryByText('Gamma')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha', 'Gamma']);
    });

    it('nests a section inside a section', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [] }] });

      await addSection('Add Section to Q3');
      await userEvent.type(await screen.findByRole('textbox'), 'Risks');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(within(await sectionFor('Q3')).getByRole('heading', { name: 'Risks' })).toBeInTheDocument();
    });

    // Three nested sections is the cap. The deepest one still takes reports — it just can't hold
    // another section, and the button is gone rather than sitting there disabled.
    it('stops offering Add Section at the third level, but still offers Add Report', async () => {
      const nested = (title: string, children: StoredNode[]): StoredNode => ({
        type: 'section',
        params: { title },
        children,
      });
      renderReport({ savedSections: [nested('One', [nested('Two', [nested('Three', [])])])] });

      expect(await screen.findByRole('button', { name: 'Add Section to Two' })).toBeInTheDocument();
      expect(await screen.findByRole('button', { name: 'Add Report to Three' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Add Section to Three' })).not.toBeInTheDocument();
    });
  });

  describe('a child report that no longer exists', () => {
    const deleted = [stored('a'), stored('gone'), stored('b')];

    it('names the missing report and keeps the rest of the document intact', async () => {
      renderReport({ savedSections: deleted });

      const card = await screen.findByTestId('missing-report');

      expect(card).toHaveTextContent(/Report not found/);
      expect(card).toHaveTextContent('gone');
      expect(screen.getAllByTestId('child-report').map((node) => node.textContent)).toEqual(['month', 'week']);
    });

    it('can be removed like any other node', async () => {
      renderReport({ savedSections: deleted });

      await clickControl('Remove missing report gone');

      expect(screen.queryByTestId('missing-report')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha', 'Beta']);
    });
  });
});
