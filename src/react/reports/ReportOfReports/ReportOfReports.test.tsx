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
import { JiraProvider } from '../../services/jira';
import { ReportLayoutProvider } from '../../services/report-layout';
import { useCanObservable } from '../../hooks/useCanObservable';

// The field catalog is fetched with `useSuspenseQuery`; stub it so inline-value tests exercise the
// document rather than React Query's suspense plumbing. See .../003-self-reports.
vi.mock('../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => [{ id: 'summary', name: 'Summary', schema: { type: 'string' }, clauseNames: ['summary'] }],
}));

/** Records the searches inline values issue, and answers them. */
const searches: Array<{ jql: string; fields: string[] }> = [];
let searchResult: Array<{ fields: Record<string, unknown> }> = [];

const jira = {
  fetchJiraIssuesWithJQLWithNamedFields: async (params: any) => {
    searches.push(params);

    return searchResult;
  },
} as any;

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
          <JiraProvider jira={jira}>
            <ReportLayoutProvider savedReport={{ id: 'doc', sections: savedSections }}>
              <ReportOfReports currentReportId={currentReportId} childReportProps={childReportProps} />
            </ReportLayoutProvider>
          </JiraProvider>
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

/** The row a control sits on. Hover, pin, and the controls' visibility are all per row. */
const rowFor = async (name: string) =>
  (await screen.findByRole('button', { name })).closest('[data-node-row]') as HTMLElement;

/** Whether a row is currently showing its controls, as `NodeControls` publishes it. */
const controlsOn = (row: HTMLElement) => within(row).getByTestId('node-controls').getAttribute('data-visible');

/**
 * A row's controls are invisible until the pointer is somewhere in its node, so hover first — the way
 * a user has to. jsdom loads no stylesheet, so the click would land either way; the hover keeps the
 * test honest about the interaction, and the reveal itself is React state rather than a CSS `:hover`
 * rule precisely because jsdom never evaluates one. See `DocumentEditing` and .../004-redesign.
 */
const clickControl = async (name: string) => {
  const button = await screen.findByRole('button', { name });

  await userEvent.hover(button.closest('[data-node-row]') as HTMLElement);
  await userEvent.click(button);
};

/** Delete is two steps: the control opens a confirm popover anchored under it. */
const removeNode = async (label: string) => {
  await clickControl(`Remove ${label}`);
  await userEvent.click(await screen.findByTestId('confirm-delete'));
};

/** A titled section holding `children`, for the nesting cases. */
const nest = (title: string, children: StoredNode[]): StoredNode => ({ type: 'section', params: { title }, children });

/** A container's add row, found through one of its buttons rather than by position in the tree. */
const addRowFor = async (title: string) =>
  (await screen.findByRole('button', { name: `Add Report to ${title}` })).closest(
    '[data-testid="add-content-row"]',
  ) as HTMLElement;

/** Same as {@link clickControl}, for the add row a section only shows while it's pointed at. */
const clickAdd = async (name: string) => {
  const button = await screen.findByRole('button', { name });
  const section = button.closest('section');

  if (section) {
    await userEvent.hover(section);
  }

  await userEvent.click(button);
};

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
    searches.length = 0;
    searchResult = [];
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
      savedSections: [{ type: 'inline-report-grid', params: { columns: 2 } } as unknown as StoredNode],
    });

    expect(await screen.findByTestId('report-card')).toHaveTextContent(/inline-report-grid/);
    expect(screen.getByRole('button', { name: 'Add Report' })).toBeInTheDocument();
  });

  // See spec/016-report-of-reports Phase 4.
  describe('editing the document', () => {
    const threeReports = [stored('c'), stored('a'), stored('b')];

    it('removes the chosen card and leaves the rest in order', async () => {
      renderReport({ savedSections: threeReports });

      await removeNode('Alpha');

      expect(cardNames()).toEqual(['Gamma', 'Beta']);
    });

    it('leaves the node alone when the delete is cancelled', async () => {
      renderReport({ savedSections: threeReports });

      await clickControl('Remove Alpha');
      await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

      expect(cardNames()).toEqual(['Gamma', 'Alpha', 'Beta']);
    });

    // A section takes everything inside it, which is worth saying out loud before it happens.
    it('says what else a section takes with it', async () => {
      const section: StoredNode = { type: 'section', params: { title: 'Q3' }, children: [stored('a')] };
      renderReport({ savedSections: [section] });

      await clickControl('Remove Q3');

      expect(await screen.findByTestId('delete-confirm')).toHaveTextContent('Delete "Q3" and everything inside it?');
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

  // See spec/016-report-of-reports/004-redesign §5.
  describe('row controls', () => {
    const threeReports = [stored('c'), stored('a'), stored('b')];

    it('shows a row’s controls only while the pointer is in it', async () => {
      renderReport({ savedSections: threeReports });

      const row = await rowFor('Move Alpha up');

      expect(controlsOn(row)).toBe('false');

      await userEvent.hover(row);
      expect(controlsOn(row)).toBe('true');

      await userEvent.unhover(row);
      expect(controlsOn(row)).toBe('false');
    });

    // Hover is keyed by path and tested by prefix, so a report's controls appear while the pointer is
    // anywhere in that node — including on the chart, which is most of what there is to point at.
    it('counts the embedded report itself as part of the row’s node', async () => {
      renderReport({ savedSections: threeReports });

      const row = await rowFor('Move Alpha up');

      await userEvent.hover(within(row.parentElement as HTMLElement).getByTestId('child-report'));

      expect(controlsOn(row)).toBe('true');
    });

    // Clicking pins the row: the touch and keyboard path to controls that otherwise need a pointer.
    it('keeps a clicked row’s controls up after the pointer leaves', async () => {
      renderReport({ savedSections: threeReports });

      const row = await rowFor('Move Alpha up');

      await userEvent.click(row);
      await userEvent.unhover(row);

      expect(controlsOn(row)).toBe('true');
    });

    // The pin is keyed by node id, not by path, so it follows the node it was put on.
    it('keeps a row pinned through the move it was clicked to make', async () => {
      renderReport({ savedSections: threeReports });

      await userEvent.click(await rowFor('Move Alpha up'));
      await clickControl('Move Alpha up');

      expect(cardNames()).toEqual(['Alpha', 'Gamma', 'Beta']);

      const moved = await rowFor('Move Alpha up');

      await userEvent.unhover(moved);
      expect(controlsOn(moved)).toBe('true');
    });

    it('drops the pin on Escape', async () => {
      renderReport({ savedSections: threeReports });

      const row = await rowFor('Move Alpha up');

      await userEvent.click(row);
      await userEvent.unhover(row);

      await userEvent.keyboard('{Escape}');

      expect(controlsOn(row)).toBe('false');
    });

    // Exactly one row at a time, however deep the document goes. `stopPropagation` is what does it:
    // the innermost wrapper takes the event away from its ancestors, so pointing at a report inside
    // three nested sections lights up that report and none of the sections above it.
    it('lights up only the row the pointer is on, not its ancestors', async () => {
      renderReport({ savedSections: [nest('One', [nest('Two', [nest('Three', [stored('a')])])])] });

      await userEvent.hover(await rowFor('Move Alpha up'));

      expect(controlsOn(await rowFor('Move Alpha up'))).toBe('true');
      expect(controlsOn(await rowFor('Move Three up'))).toBe('false');
      expect(controlsOn(await rowFor('Move Two up'))).toBe('false');
      expect(controlsOn(await rowFor('Move One up'))).toBe('false');
    });

    it('keeps a section’s add row up while the pointer is on a node inside it', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [stored('a')] }] });

      const section = (await sectionTitle('Q3')).closest('section') as HTMLElement;
      const addRow = within(section).getByTestId('add-content-row');

      expect(addRow).toHaveAttribute('data-visible', 'false');

      await userEvent.hover(await rowFor('Move Alpha up'));

      expect(addRow).toHaveAttribute('data-visible', 'true');
    });

    it('does not offer to rename an embedded report', async () => {
      renderReport({ savedSections: [stored('a')] });

      expect(await screen.findByRole('heading', { name: 'Alpha' })).toBeInTheDocument();
      // What a section's title renders as. A report's name belongs to the saved report, not to the
      // document, so this row is read-only.
      expect(screen.queryByRole('button', { name: 'Alpha, edit' })).toBeNull();
    });
  });

  // A chart is most of what there is to scroll past, so a report collapses like a section does.
  describe('collapsing a report', () => {
    it('hides the chart and leaves the row, without remounting anything', async () => {
      renderReport({ savedSections: [stored('a'), stored('b')] });

      expect(await screen.findByRole('button', { name: 'Collapse Alpha' })).toBeInTheDocument();
      expect(mounts).toEqual(['month', 'week']);

      await userEvent.click(screen.getByRole('button', { name: 'Collapse Alpha' }));

      expect(screen.getAllByTestId('child-report')[0]).not.toBeVisible();
      // Its own row stays, and its neighbour is untouched.
      expect(screen.getByRole('heading', { name: 'Alpha' })).toBeVisible();
      expect(screen.getAllByTestId('child-report')[1]).toBeVisible();

      await userEvent.click(await screen.findByRole('button', { name: 'Expand Alpha' }));

      expect(screen.getAllByTestId('child-report')[0]).toBeVisible();
      expect(mounts).toEqual(['month', 'week']);
    });

    // The other half of the print contract — a collapsed chart is a separate wrapper from a
    // collapsed section's, and regresses independently. See the section case for why this matters.
    it('hides the chart in a way print can put back', async () => {
      renderReport({ savedSections: [stored('a')] });

      await userEvent.click(await screen.findByRole('button', { name: 'Collapse Alpha' }));

      expect(screen.getByTestId('child-report').closest('[hidden]')).toHaveClass('collapsed-content');
    });

    it('gives no caret to a row with nothing beneath it', async () => {
      renderReport({
        savedSections: [{ type: 'inline-report', params: { expression: '(issue = ABC-1).summary' } }, stored('gone')],
      });

      expect(await screen.findByTestId('missing-report')).toBeInTheDocument();
      // A value has no content of its own and a missing report has only its explanation, so neither
      // offers a caret — nor reserves the space for one.
      expect(screen.queryByRole('button', { name: /^Collapse/ })).toBeNull();
    });
  });

  // See spec/016-report-of-reports/004-redesign §3.
  describe('collapsing a section', () => {
    const withChildren: StoredNode[] = [
      { type: 'section', params: { title: 'Q3' }, children: [stored('a'), stored('b')] },
    ];

    it('hides everything inside the section, its add row included', async () => {
      renderReport({ savedSections: withChildren });

      await userEvent.click(await screen.findByRole('button', { name: 'Collapse Q3' }));

      // Still mounted — expanding must not refetch — but hidden from the page and from a reader.
      expect(screen.getAllByTestId('report-card')[0]).not.toBeVisible();
      expect(screen.queryByRole('button', { name: 'Add Report to Q3' })).toBeNull();
      // The row itself stays, and the caret is the only thing that changed about it.
      expect(screen.getByRole('heading', { name: 'Q3' })).toBeVisible();
    });

    /**
     * The assertions above are all satisfied by the `hidden` attribute alone, so on its own nothing
     * here notices if `.collapsed-content` goes missing — and that class is the whole reason the
     * subtree stays mounted rather than being unmounted. It is what `@media print` overrides
     * (src/css/print.css), so losing it means "collapse a section to tidy the screen, then Download
     * PDF" silently drops that section from the PDF. jsdom loads no stylesheet and cannot show that,
     * so pin the contract structurally instead.
     */
    it('hides collapsed content in a way print can put back', async () => {
      renderReport({ savedSections: withChildren });

      await userEvent.click(await screen.findByRole('button', { name: 'Collapse Q3' }));

      const hiddenWrapper = screen.getAllByTestId('report-card')[0].closest('[hidden]');

      expect(hiddenWrapper).toHaveClass('collapsed-content');
      // The wrapper must carry no `display` utility of its own, or it would fight the print rule.
      expect(hiddenWrapper?.className).not.toMatch(/\b(hidden|block|flex|grid|inline)\b/);
    });

    it('brings it back without remounting the children', async () => {
      renderReport({ savedSections: withChildren });

      expect(await screen.findByRole('button', { name: 'Collapse Q3' })).toBeInTheDocument();
      expect(mounts).toEqual(['month', 'week']);

      await userEvent.click(screen.getByRole('button', { name: 'Collapse Q3' }));
      await userEvent.click(await screen.findByRole('button', { name: 'Expand Q3' }));

      expect(screen.getAllByTestId('report-card')[0]).toBeVisible();
      expect(mounts).toEqual(['month', 'week']);
    });

    // Collapse is keyed by node id for the same reason the pin is: keyed by path, reordering the
    // siblings of a collapsed section would collapse whichever section landed in its place.
    it('follows the section it was collapsed on', async () => {
      renderReport({ savedSections: [...withChildren, { type: 'section', params: { title: 'Q4' }, children: [] }] });

      await userEvent.click(await screen.findByRole('button', { name: 'Collapse Q3' }));
      await clickControl('Move Q3 down');

      expect(await screen.findByRole('button', { name: 'Expand Q3' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Collapse Q4' })).toBeInTheDocument();
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
    const addSection = async (name = 'Add Section') => clickAdd(name);

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

    // The add row is invisible until the section is pointed at, so an empty one would otherwise read
    // as broken. The copy and the buttons share a fixed-height slot, so revealing them shifts nothing.
    it('says so when a section is empty', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [] }] });

      expect(await screen.findByText('Nothing here yet.')).toBeInTheDocument();
    });

    // The add row belongs to a container, so "hovered" means the *innermost* container the pointer is
    // in — not every container it happens to be inside. Otherwise pointing at something three levels
    // deep offers to add at all three levels at once, and the deepest offer is the only one meant.
    it('offers to add only in the innermost container, however deep the pointer is', async () => {
      renderReport({ savedSections: [nest('One', [nest('Two', [nest('Three', [stored('a')])])])] });

      const three = await addRowFor('Three');
      const two = await addRowFor('Two');
      const one = await addRowFor('One');

      await userEvent.hover(await rowFor('Move Alpha up'));

      expect(three).toHaveAttribute('data-visible', 'true');
      expect(two).toHaveAttribute('data-visible', 'false');
      expect(one).toHaveAttribute('data-visible', 'false');
      // The document root's pair is the one exception: it is always offered. Its buttons carry the
      // bare label, so this finds the root row and not one of the three above.
      expect(
        screen.getByRole('button', { name: 'Add Report' }).closest('[data-testid="add-content-row"]'),
      ).toHaveAttribute('data-visible', 'true');
    });

    // Sharing that slot means being positioned, and a positioned element paints over its in-flow
    // siblings at any opacity — so the faded-out copy would swallow every click on the buttons
    // underneath it. A class assertion because the failure is a real browser's hit testing: jsdom
    // loads no stylesheet and hit-tests nothing, so a click here succeeds either way.
    it('does not let the empty-section copy take clicks meant for the buttons', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [] }] });

      expect(await screen.findByTestId('empty-container-note')).toHaveClass('pointer-events-none');
    });

    // The buttons reveal themselves on `focus-within` so the keyboard has a path to them, but this
    // copy is their sibling and cannot see that focus — so it needs the group to fade out with them.
    // Without it a keyboard user tabs the buttons in *underneath* fully opaque text. A class
    // assertion for the same reason as above: jsdom has no stylesheet to compute this from.
    it('clears the empty-section copy for a keyboard user, not just a pointer', async () => {
      renderReport({ savedSections: [{ type: 'section', params: { title: 'Q3' }, children: [] }] });

      const note = await screen.findByTestId('empty-container-note');

      expect(note).toHaveClass('group-focus-within:opacity-0');
      expect(note.parentElement).toHaveClass('group');
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

      await clickAdd('Add Report to Q3');
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

  // See spec/016-report-of-reports/003-self-reports.
  describe('inline values', () => {
    const storedValue = (expression: string): StoredNode =>
      ({ type: 'inline-report', params: { expression } }) as StoredNode;

    const value = () => screen.findByTestId('inline-value');

    it('renders the field name and the resolved value', async () => {
      searchResult = [{ fields: { Summary: 'Migrate auth to OIDC' } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).summary')] });

      expect(await value()).toHaveTextContent('Summary');
      expect(await value()).toHaveTextContent('Migrate auth to OIDC');
    });

    it('asks Jira for the expression’s own JQL and field', async () => {
      searchResult = [{ fields: { Summary: 'Migrate auth to OIDC' } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).summary')] });

      await value();

      expect(searches).toEqual([expect.objectContaining({ jql: 'issue = ABC-1', fields: ['summary'] })]);
    });

    // A malformed expression must not take the document down with it.
    it('renders a parse error beside the rest of the document', async () => {
      searchResult = [];
      renderReport({ savedSections: [storedValue('issue = ABC-1'), stored('a')] });

      const problem = await screen.findByTestId('inline-value-error');

      expect(problem).toHaveTextContent(/starts with "\("/);
      expect(problem).toHaveTextContent('issue = ABC-1');
      expect(cardNames()).toEqual(['Alpha']);
    });

    it('reports a query that matched nothing', async () => {
      searchResult = [];
      renderReport({ savedSections: [storedValue('(issue = NOPE-1).summary')] });

      expect(await screen.findByTestId('inline-value-error')).toHaveTextContent('No work item matched.');
    });

    it('prompts for an expression when the node is blank', async () => {
      renderReport({ savedSections: [storedValue('')] });

      expect(await screen.findByText(/Write an expression/)).toBeInTheDocument();
    });

    // "Add Value" is parked by .../004-redesign §6 — the add row is two buttons again — so these seed
    // the node the way a saved document does. Everything a value *does* is still covered; only the
    // way one comes into existence is gone.
    it('resolves an expression typed into a blank value', async () => {
      searchResult = [{ fields: { Summary: 'Rotate signing keys' } }];
      renderReport({ savedSections: [storedValue('')] });

      await userEvent.click(await screen.findByRole('button', { name: 'inline value, edit' }));
      await userEvent.type(await screen.findByRole('textbox'), '(issue = ABC-2).summary');
      await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));

      expect(await value()).toHaveTextContent('Rotate signing keys');
    });

    it('renders a value nested in a section, inside that section', async () => {
      searchResult = [{ fields: { Summary: 'inside' } }];
      renderReport({
        savedSections: [
          { type: 'section', params: { title: 'Q3' }, children: [storedValue('(issue = ABC-3).summary')] },
        ],
      });

      const section = (await sectionTitle('Q3')).closest('section') as HTMLElement;

      expect(within(section).getByTestId('inline-value')).toHaveTextContent('inside');
    });

    it('can be removed like any other node', async () => {
      searchResult = [{ fields: { Summary: 'gone soon' } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).summary'), stored('a')] });

      await removeNode('(issue = ABC-1).summary');

      expect(screen.queryByTestId('inline-value')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha']);
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

      await removeNode('missing report gone');

      expect(screen.queryByTestId('missing-report')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha', 'Beta']);
    });
  });
});
