import type { AppStorage } from '../../../jira/storage/common';
import type { StoredNode } from './model/sections';
import type { ComponentProps } from 'react';

import React, { Suspense } from 'react';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
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
  useJiraIssueFields: () => [
    { id: 'summary', name: 'Summary', schema: { type: 'string' }, clauseNames: ['summary'] },
    // `comment` is here because it's real: it resolves, and then dead-ends in the formatter, which is
    // where the signpost to `.latestComment` lives. See .../007-latest-comment-report.
    { id: 'comment', name: 'Comment', schema: { type: 'comments-page' }, clauseNames: ['comment'] },
  ],
}));

/**
 * A comment body renders through `AdfDocument`, which `React.lazy`-imports `@atlaskit/renderer`. Left
 * real, every test here would pull the whole editor stack through vite's transform pipeline — which
 * took these tests past the 5s timeout under full-suite load, non-deterministically and in a different
 * test each run.
 *
 * So stub it with its own `Suspense` fallback: the local walker, rendered synchronously. These tests are
 * about what the *document* does with a comment, not about Atlassian's renderer, which has its own tests
 * in `AdfDocument.test.tsx` and its own Storybook stories.
 * See spec/016-report-of-reports/007-latest-comment-report § Rich rendering.
 */
vi.mock('../../components/AdfDocument', async () => {
  const react = await import('react');
  const { AdfBlocks, adfToBlocks } = await import('../../components/AdfBlocks');

  return {
    AdfDocument: ({ document, fallbackClassName }: { document: unknown; fallbackClassName?: string }) =>
      react.createElement(AdfBlocks, { blocks: adfToBlocks(document), className: fallbackClassName }),
  };
});

/** Records the searches inline values issue, and answers them. */
const searches: Array<{ jql: string; fields: string[] }> = [];
let searchResult: Array<{ key?: string; fields: Record<string, unknown> }> = [];

/**
 * The comment endpoint a latest-comment value reaches after the search names its work item.
 * See spec/016-report-of-reports/007-latest-comment-report.
 */
const commentRequests: string[] = [];
let commentResult: unknown = { comments: [] };

const jira = {
  fetchJiraIssuesWithJQLWithNamedFields: async (params: any) => {
    searches.push(params);

    return searchResult;
  },
  fetchLatestComment: async (issueKey: string) => {
    commentRequests.push(issueKey);

    if (commentResult instanceof Error) {
      throw commentResult;
    }

    return commentResult;
  },
  // The Add Report modal's work-item typeahead. Echoing the query back as a suggestion means a test
  // can "pick" any key it likes without a fixture per key. The empty query — which the picker asks on
  // open, for the recently-viewed list — answers with nothing.
  fetchIssuePickerSuggestions: async (query: string) => ({
    sections: query ? [{ id: 'cs', issues: [{ key: query, summaryText: `${query} summary` }] }] : [],
  }),
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
  {
    savedSections,
    currentReportId,
    unsaved,
  }: { savedSections?: StoredNode[]; currentReportId?: string; unsaved?: boolean } = {},
  storageOverride: AppStorage = storage,
) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  return render(
    <Suspense fallback="loading">
      <StorageProvider storage={storageOverride as ComponentProps<typeof StorageProvider>['storage']}>
        <QueryClientProvider client={queryClient}>
          <JiraProvider jira={jira}>
            {/* `unsaved` is a document with no `?report=` behind it, so nothing to seed from but
                the URL. See spec/016-report-of-reports/006-url-state Phase 1. */}
            <ReportLayoutProvider savedReport={unsaved ? undefined : { id: 'doc', sections: savedSections }}>
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

/**
 * Adds a value through the Add Report modal's Value Report half: pick a work item, pick a field, press
 * `+`. `opener` is the add row's button — `Add Report`, or `Add Report to Q3` for a section.
 *
 * The typeahead is debounced, so the suggestion arrives a beat after the keystroke; `findByText` waits
 * it out. `fireEvent.change` rather than `userEvent.type` because react-select's input lives in a
 * portal that repositions as it opens.
 * See spec/016-report-of-reports/009-value-report-modal Phase 6.
 */
const addValue = async (opener: string, key: string, field: string) => {
  await clickAdd(opener);

  fireEvent.change(await screen.findByLabelText('Work item'), { target: { value: key } });
  // 3s, not the 1s default: the typeahead debounces 300ms of REAL time before it even asks, and under
  // full-suite load the remaining budget isn't enough for the query and two renders. This failed once
  // in a pre-commit run and passed on every re-run, which is the signature.
  await userEvent.click(await screen.findByText(`${key} — ${key} summary`, undefined, { timeout: 3000 }));

  fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'ArrowDown' });
  await userEvent.click(await screen.findByText(field));

  await userEvent.click(screen.getByTestId('ror-value-add'));
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
    commentRequests.length = 0;
    commentResult = { comments: [] };
    mounts.length = 0;
    // Editing the document writes a `sections` param, which would otherwise seed the next test.
    window.history.replaceState({}, '', '/');
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
        savedSections: [{ type: 'inline-value', params: { expression: '(issue = ABC-1).summary' } }, stored('gone')],
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

    // Indent alone stops answering "where will this land?" once sections nest: a deep section's two
    // buttons sit a few pixels from its parent's, and both rows read the same. Pointing at one tints
    // the container it adds into, so what is about to gain a node is what lights up.
    describe('showing which container an add button belongs to', () => {
      const nested = () => renderReport({ savedSections: [nest('One', [nest('Two', [stored('a')])])] });

      /** The tint is a class; the attribute is how it is asserted, for the reason hover is state. */
      const targeted = (section: HTMLElement) => section.getAttribute('data-add-target');

      it('tints the section the pointer’s Add Report adds into, and no other', async () => {
        nested();

        const outer = await sectionFor('One');
        const inner = await sectionFor('Two');

        await userEvent.hover(await screen.findByRole('button', { name: 'Add Report to Two' }));

        expect(targeted(inner)).toBe('true');
        expect(targeted(outer)).toBe('false');
      });

      it('tints it for Add Section the same way', async () => {
        nested();

        await userEvent.hover(await screen.findByRole('button', { name: 'Add Section to Two' }));

        expect(targeted(await sectionFor('Two'))).toBe('true');
        expect(targeted(await sectionFor('One'))).toBe('false');
      });

      // Both buttons add into the same container, so crossing between them must not clear the tint —
      // it would go out and come back within a frame, which reads as a flicker rather than a cue.
      it('holds the tint while the pointer crosses from one button to the other', async () => {
        nested();

        await userEvent.hover(await screen.findByRole('button', { name: 'Add Report to Two' }));
        await userEvent.hover(await screen.findByRole('button', { name: 'Add Section to Two' }));

        expect(targeted(await sectionFor('Two'))).toBe('true');
      });

      it('drops the tint once the pointer leaves the row', async () => {
        nested();

        const button = await screen.findByRole('button', { name: 'Add Report to Two' });

        await userEvent.hover(button);
        await userEvent.unhover(button);

        expect(targeted(await sectionFor('Two'))).toBe('false');
      });

      // The buttons reveal themselves on `focus-within`, so a keyboard user meets the same puzzle a
      // pointer user does: a pair of buttons, and nothing saying whose they are.
      it('tints for the keyboard too, and clears when focus leaves', async () => {
        nested();

        const button = await screen.findByRole('button', { name: 'Add Report to Two' });

        await act(async () => button.focus());
        expect(targeted(await sectionFor('Two'))).toBe('true');

        await act(async () => button.blur());
        expect(targeted(await sectionFor('Two'))).toBe('false');
      });

      // The root's pair adds at the top level. Tinting "the document" would be the whole page, and
      // nothing lit is already what top-level means — every section stays untinted instead.
      it('tints nothing for the document root’s own buttons', async () => {
        nested();

        // The root's buttons carry the bare label, so this finds the root row and not one of the two
        // sections' — see the innermost-container case above.
        await userEvent.hover(await screen.findByRole('button', { name: 'Add Report' }));

        expect(targeted(await sectionFor('One'))).toBe('false');
        expect(targeted(await sectionFor('Two'))).toBe('false');
      });

      // The picker covers the document and the pointer never moves, so a tint left set would sit
      // behind the modal and outlive the choice that closed it.
      it('drops the tint when the picker opens', async () => {
        nested();

        await userEvent.click(await screen.findByRole('button', { name: 'Add Report to Two' }));

        expect(targeted(await sectionFor('Two'))).toBe('false');
      });
    });
  });

  // See spec/016-report-of-reports/003-self-reports.
  describe('inline values', () => {
    const storedValue = (expression: string): StoredNode =>
      ({ type: 'inline-value', params: { expression } }) as StoredNode;

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

    // A blank value says nothing — no instructions in the document — and there is nothing to click: it
    // can only arrive from a saved or hand-edited document, and the way to be rid of it is delete.
    it('renders a blank value as an empty row with nothing to edit', async () => {
      renderReport({ savedSections: [storedValue(''), stored('a')] });

      // The document renders around it; the row itself offers no edit affordance.
      expect(await screen.findByTestId('report-card')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'inline value, edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    // A value node is read-only: both halves are chosen in the modal, and a wrong one is deleted rather
    // than corrected. See .../009-value-report-modal § The node stops being editable.
    it('offers no way to edit a resolved value in place', async () => {
      searchResult = [{ fields: { Summary: 'Migrate auth to OIDC' } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).summary')] });

      await value();

      expect(screen.queryByRole('button', { name: /, edit$/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('renders a value nested in a section, inside that section', async () => {
      searchResult = [{ fields: { Summary: 'inside' } }];
      renderReport({
        savedSections: [
          { type: 'section', params: { title: 'Q3' }, children: [storedValue('(issue = ABC-3).summary')] },
        ],
      });

      const section = (await sectionTitle('Q3')).closest('section') as HTMLElement;

      // `find`, not `get`: the section's title button is on screen a render before its value has
      // resolved, so a synchronous read here races the expression's own Jira lookup.
      expect(await within(section).findByTestId('inline-value')).toHaveTextContent('inside');
    });

    /**
     * Named by what the user picked in the modal, never by the stored expression — a confirm dialog
     * saying `Delete "(issue = ABC-1).summary"?` puts an internal storage format in front of someone
     * who never typed one. See .../009-value-report-modal § The node stops being editable.
     */
    it('names itself by work item and field in its controls, not by its expression', async () => {
      searchResult = [{ fields: { Summary: 'gone soon' } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).summary'), stored('a')] });

      await value();

      expect(screen.getByRole('button', { name: 'Remove ABC-1 Summary' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /issue = ABC-1/ })).not.toBeInTheDocument();

      await removeNode('ABC-1 Summary');

      expect(screen.queryByTestId('inline-value')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha']);
    });

    // The field name only exists once the expression resolves, so the label has to degrade rather than
    // read "ABC-1 undefined" or fall back to the expression it is there to avoid showing.
    it('falls back to the work item alone when the field cannot resolve', async () => {
      searchResult = [];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).nope')] });

      expect(await screen.findByTestId('inline-value-error')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove ABC-1' })).toBeInTheDocument();
    });

    // `.comment` is a real field, so it resolves and then dead-ends in the formatter. That message is
    // the only signpost to the pseudo-accessor, which by definition isn't in Jira's field list.
    it('points a .comment expression at .latestComment', async () => {
      searchResult = [{ fields: { Comment: { comments: [], total: 0 } } }];
      renderReport({ savedSections: [storedValue('(issue = ABC-1).comment')] });

      expect(await screen.findByTestId('inline-value-error')).toHaveTextContent(
        "Comments can't show as a value — use .latestComment for the newest one.",
      );
    });
  });

  /**
   * The same `inline-value` node, whose accessor is `latestComment` — a preset, not a second node type.
   * See spec/016-report-of-reports/007-latest-comment-report.
   */
  describe('latest comment values', () => {
    const storedComment = (issueKey: string): StoredNode =>
      ({ type: 'inline-value', params: { expression: `(issue = ${issueKey}).latestComment` } }) as StoredNode;

    const comment = (text: string) => ({
      comments: [
        {
          body: { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text }] }] },
          author: { displayName: 'Dana Ruiz' },
          created: '2026-08-04T14:22:00.000Z',
        },
      ],
    });

    /** A resolvable work item — the search names it, the comment endpoint answers for it. */
    const resolves = (key = 'ABC-1', text = 'Blocked on the SSO cert rotation.') => {
      searchResult = [{ key, fields: {} }];
      commentResult = comment(text);
    };

    const body = () => screen.findByTestId('latest-comment');

    it('renders the comment, then who updated it and when', async () => {
      resolves();
      renderReport({ savedSections: [storedComment('ABC-1')] });

      expect(await body()).toHaveTextContent('Blocked on the SSO cert rotation.');
      expect(screen.getByText('Updated by: Dana Ruiz')).toBeInTheDocument();
      expect(screen.getByText(/^Last updated: /)).toBeInTheDocument();
    });

    // The row is the key as the node's heading — no "Latest comment" prefix, and never the raw
    // expression. See .../007-latest-comment-report § The row is the key.
    it('heads the node with the key, not the expression', async () => {
      resolves();
      renderReport({ savedSections: [storedComment('ABC-1')] });

      await body();

      expect(screen.getByRole('heading', { name: 'ABC-1' })).toBeInTheDocument();
      expect(screen.queryByText('Latest comment')).not.toBeInTheDocument();
      expect(screen.queryByText('(issue = ABC-1).latestComment')).not.toBeInTheDocument();
    });

    // Two requests, deliberately: the search names the work item, the comment endpoint answers for it.
    it('reaches the comment endpoint through the key the search found', async () => {
      resolves('SYSTEMS-918');
      renderReport({ savedSections: [storedComment('SYSTEMS-918')] });

      await body();

      expect(searches).toEqual([
        expect.objectContaining({ jql: 'issue = SYSTEMS-918', fields: ['summary'], maxResults: 2 }),
      ]);
      expect(commentRequests).toEqual(['SYSTEMS-918']);
    });

    it('renders the comment as semantic HTML rather than flattened text', async () => {
      searchResult = [{ key: 'ABC-1', fields: {} }];
      commentResult = {
        comments: [
          {
            body: {
              type: 'doc',
              version: 1,
              content: [
                {
                  type: 'bulletList',
                  content: [
                    {
                      type: 'listItem',
                      content: [{ type: 'paragraph', content: [{ type: 'text', text: 'cert rotation' }] }],
                    },
                  ],
                },
              ],
            },
            author: { displayName: 'Dana Ruiz' },
            created: '2026-08-04T14:22:00.000Z',
          },
        ],
      };
      renderReport({ savedSections: [storedComment('ABC-1')] });

      await body();

      expect(screen.getByText('cert rotation').closest('ul')).toBeInTheDocument();
    });

    // Authoring is the Add Report modal's now, and picking `Latest Comment` is what makes the node a
    // comment node — the accessor in the expression is still the whole of the distinction.
    // See .../009-value-report-modal Phase 6.
    it('is added from the Add Report modal, into the section it was opened from', async () => {
      resolves('ABC-1', 'Blocked on the cert.');
      renderReport({ savedSections: [nest('Q3', [])] });

      await addValue('Add Report to Q3', 'ABC-1', 'Latest Comment');

      const section = (await sectionTitle('Q3')).closest('section') as HTMLElement;

      expect(await within(section).findByTestId('latest-comment')).toHaveTextContent('Blocked on the cert.');
      expect(within(section).getByRole('heading', { name: 'ABC-1' })).toBeInTheDocument();
    });

    // A reversal of 007, which made the button section-only on the reasoning that a note belongs beside
    // what it comments on. One modal that changes shape by origin costs more to explain than that is
    // worth. See .../009-value-report-modal § Decided with the user.
    // The add row that opened the modal sits inside one specific container, and the modal covers it.
    // See .../009-value-report-modal § Restructure.
    it('names the section it was opened from', async () => {
      renderReport({ savedSections: [nest('Q3', [])] });

      await clickAdd('Add Report to Q3');

      expect(await screen.findByText('Adding to Q3')).toBeInTheDocument();
    });

    it('can be added at the document root too', async () => {
      resolves('ABC-1', 'At the top.');
      renderReport({ savedSections: [] });

      await addValue('Add Report', 'ABC-1', 'Latest Comment');

      expect(await body()).toHaveTextContent('At the top.');
    });

    it('adds an ordinary field from the same two controls', async () => {
      searchResult = [{ key: 'ABC-1', fields: { Summary: 'Migrate auth to OIDC' } }];
      renderReport({ savedSections: [] });

      await addValue('Add Report', 'ABC-1', 'Summary');

      expect(await screen.findByTestId('inline-value')).toHaveTextContent('Migrate auth to OIDC');
    });

    // A blank node can only come from a document saved before the modal existed. It states the fact and
    // asks nothing — a request built from `issue =` could only fail.
    it('asks Jira nothing for a node with no work item set', async () => {
      renderReport({ savedSections: [storedComment('')] });

      expect(await screen.findByText('No work item set.')).toBeInTheDocument();
      expect(searches).toEqual([]);
      expect(commentRequests).toEqual([]);
    });

    it('reports a work item with no comments without taking the document down', async () => {
      searchResult = [{ key: 'ABC-1', fields: {} }];
      commentResult = { comments: [], total: 0 };
      renderReport({ savedSections: [storedComment('ABC-1'), stored('a')] });

      expect(await screen.findByText('No updates found.')).toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha']);
    });

    it('reports a key that matched nothing', async () => {
      searchResult = [];
      renderReport({ savedSections: [storedComment('NOPE-1')] });

      expect(await screen.findByTestId('latest-comment-error')).toHaveTextContent('No work item matched.');
      expect(commentRequests).toEqual([]);
    });

    // Content beneath the row means a caret, per .../004-redesign. The body stays mounted while hidden
    // so print can restore it, the same way a chart's does.
    it('offers a caret that hides the comment and leaves the row', async () => {
      resolves();
      renderReport({ savedSections: [storedComment('ABC-1')] });

      await body();
      await userEvent.click(screen.getByRole('button', { name: 'Collapse ABC-1' }));

      expect(screen.getByTestId('latest-comment').closest('[hidden]')).toBeInTheDocument();
      // The key is the row, so collapsed the node is `▸ ABC-1` and that heading is what has to survive.
      expect(screen.getByRole('heading', { name: 'ABC-1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand ABC-1' })).toBeInTheDocument();
    });

    it('renders inside the section it belongs to', async () => {
      resolves('ABC-3', 'inside');
      renderReport({ savedSections: [nest('Q3', [storedComment('ABC-3')])] });

      const section = (await sectionTitle('Q3')).closest('section') as HTMLElement;

      expect(await within(section).findByTestId('latest-comment')).toHaveTextContent('inside');
    });

    it('moves and deletes like any other node', async () => {
      resolves();
      renderReport({ savedSections: [stored('a'), storedComment('ABC-1')] });

      await body();
      await clickControl('Move ABC-1 up');

      expect(await body()).toBeInTheDocument();

      await removeNode('ABC-1');

      expect(screen.queryByTestId('latest-comment')).not.toBeInTheDocument();
      expect(cardNames()).toEqual(['Alpha']);
    });

    /**
     * The modal can't write one, but a document saved earlier can hold one — so it still fetches (the
     * hook takes the JQL either way) and it still has to title itself with something. That something is
     * the JQL, since no single work item is named.
     */
    it('renders a hand-written query, titled with the query', async () => {
      resolves('ABC-9', 'from a query');
      const expression = '(assignee = currentUser() AND updated > -1d).latestComment';
      renderReport({ savedSections: [{ type: 'inline-value', params: { expression } } as StoredNode] });

      expect(await body()).toHaveTextContent('from a query');
      expect(searches).toEqual([
        expect.objectContaining({ jql: 'assignee = currentUser() AND updated > -1d', fields: ['summary'] }),
      ]);
      expect(screen.getByRole('heading', { name: 'assignee = currentUser() AND updated > -1d' })).toBeInTheDocument();
    });

    /**
     * Delete is the only correction there is, so the controls it hangs off have to be reachable — which
     * is the whole reason a blank row keeps its min-height. 007's § Editing can't un-make the node and
     * its two recovery tests are gone with the edit field: a node nothing can type into cannot be typed
     * out of being a comment node.
     * See .../009-value-report-modal § The node stops being editable.
     */
    it('offers no edit affordance, but still offers delete', async () => {
      resolves();
      renderReport({ savedSections: [storedComment('ABC-1'), stored('a')] });

      await body();

      expect(screen.queryByRole('button', { name: 'ABC-1, edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('textbox')).not.toBeInTheDocument();

      await removeNode('ABC-1');

      expect(screen.queryByTestId('latest-comment')).not.toBeInTheDocument();
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

  /**
   * The node type the secondary-slot migration writes: a whole report configured in the document
   * rather than referring out to a saved one. Nothing here can create one — the migration does, and
   * a hand-edited `sections` param can. See spec/018-card-report/alt-plan.md.
   */
  describe('inline reports', () => {
    const storedInlineReport = (query: string): StoredNode => ({ type: 'inline-report', params: { query } });

    /** What the migration produces: one config, split into a chart and a card board over one JQL. */
    const migrated = [
      storedInlineReport('jql=project%3DA&primaryReportType=start-due&roundTo=month'),
      storedInlineReport('jql=project%3DA&primaryReportType=due&roundTo=week'),
    ];

    it('renders each inline report from its own query', async () => {
      renderReport({ savedSections: migrated });

      expect((await screen.findAllByTestId('child-report')).map((node) => node.textContent)).toEqual(['month', 'week']);
    });

    // It has no saved report and so no name — the report type is the only thing there is to say, and
    // it is what tells the migration's two children apart.
    it('names each row after its report type', async () => {
      renderReport({ savedSections: migrated });

      await screen.findAllByTestId('child-report');

      expect(cardNames()).toEqual(['Gantt Chart', 'Scatter Plot']);
    });

    it('falls back to the default report type’s name for a query that names none', async () => {
      renderReport({ savedSections: [storedInlineReport('jql=project%3DA')] });

      await screen.findAllByTestId('child-report');

      expect(cardNames()).toEqual(['Gantt Chart']);
    });

    it('renders alongside saved-report children and sections', async () => {
      renderReport({ savedSections: [stored('a'), nest('Q3', [migrated[1]])] });

      await screen.findAllByTestId('child-report');

      expect(cardNames()).toEqual(['Alpha', 'Scatter Plot']);
      expect(await sectionTitle('Q3')).toBeInTheDocument();
    });

    it('moves and deletes like any other node', async () => {
      renderReport({ savedSections: [stored('a'), ...migrated] });

      await clickControl('Move Gantt Chart up');

      expect(cardNames()).toEqual(['Gantt Chart', 'Alpha', 'Scatter Plot']);

      await removeNode('Scatter Plot');

      expect(cardNames()).toEqual(['Gantt Chart', 'Alpha']);
    });

    it('collapses its report and leaves its row', async () => {
      renderReport({ savedSections: [migrated[0]] });

      await userEvent.click(await screen.findByRole('button', { name: 'Collapse Gantt Chart' }));

      expect(screen.getByTestId('child-report').closest('[hidden]')).not.toBeNull();
      expect(screen.getByRole('button', { name: 'Expand Gantt Chart' })).toBeInTheDocument();
    });

    /**
     * The failure mode this guards is silent and total: the serializer's fall-through is the
     * saved-report branch, so an inline report it had no case for would be written back as
     * `{ type: 'saved-report', params: { reportId: undefined } }` — the report replaced by a broken
     * reference the moment anything saved the document.
     */
    it('survives a save with its query intact', async () => {
      // Written out through the URL param, which is exactly `toStoredSections` — the same value the
      // save path writes to the record's `sections` field.
      window.history.replaceState({}, '', `/?sections=${encodeURIComponent(JSON.stringify(migrated))}`);

      renderReport({ unsaved: true });

      await screen.findAllByTestId('child-report');
      // Any structural edit is enough to make the provider write the whole tree out.
      await clickControl('Move Scatter Plot up');

      expect(JSON.parse(new URLSearchParams(window.location.search).get('sections') as string)).toEqual([
        migrated[1],
        migrated[0],
      ]);
    });
  });

  // The headline case for spec/016-report-of-reports/006-url-state: build a document, refresh, and
  // it's still there. There is no `?report=` and so no record to re-seed from — the URL is carrying
  // the whole thing.
  describe('a document in the URL', () => {
    it('renders the children a sections param names, with no saved report at all', async () => {
      window.history.replaceState(
        {},
        '',
        `/?sections=${encodeURIComponent(JSON.stringify([nest('Q3', [stored('b')]), stored('a')]))}`,
      );

      renderReport({ unsaved: true });

      expect(await sectionTitle('Q3')).toBeInTheDocument();
      expect(cardNames()).toEqual(['Beta', 'Alpha']);
    });

    it('grows the param as the document is edited', async () => {
      renderReport({ unsaved: true });

      await addReport('Alpha');

      expect(new URLSearchParams(window.location.search).get('sections')).toBe(JSON.stringify([stored('a')]));
    });
  });
});
