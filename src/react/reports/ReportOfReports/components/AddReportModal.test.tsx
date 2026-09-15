import type { FC, ReactNode } from 'react';
import type { Report } from '../../../../jira/reports';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { AddReportModal } from './AddReportModal';

// The Work Item Value half fetches; the saved-report half — which is what these tests are about — does
// not. Stub both fetches so the modal mounts without Jira. `useJiraIssueFields` is a suspense query,
// which is why it is mocked rather than stubbed through the provider.
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => [{ id: 'summary', name: 'Summary' }],
}));

const jira = { fetchIssuePickerSuggestions: async () => ({ sections: [] }) } as unknown as Jira;

const report = (id: string, name: string): Report => ({ id, name, queryParams: `jql=project%3D${id}` });

const renderModal = (overrides: Partial<React.ComponentProps<typeof AddReportModal>> = {}) => {
  const props = {
    isOpen: true,
    reports: [report('a', 'Alpha'), report('b', 'Beta')],
    onSelect: vi.fn(),
    onAddValue: vi.fn(),
    onClose: vi.fn(),
    ...overrides,
  };

  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <AddReportModal {...props} />
    </Wrapper>,
  );

  return props;
};

/**
 * The reports search, by placeholder rather than by role: the Work Item Value row puts a second textbox in
 * the modal, so a bare `getByRole('textbox')` now matches more than one and throws.
 */
const reportSearch = () => screen.getByPlaceholderText('Search reports by name or type…');

describe('<AddReportModal>', () => {
  it('lists the reports it is given', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('reports the chosen report id', async () => {
    const { onSelect } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Beta' }));

    expect(onSelect).toHaveBeenCalledWith('b');
  });

  it('explains itself when there is nothing left to add', async () => {
    renderModal({ reports: [] });

    expect(await screen.findByText(/No other saved reports/)).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    renderModal({ isOpen: false });

    expect(screen.queryByRole('button', { name: 'Alpha' })).not.toBeInTheDocument();
  });

  it('closes on cancel', async () => {
    const { onClose } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

    expect(onClose).toHaveBeenCalled();
  });

  it("shows each report's type as a badge", async () => {
    renderModal({
      reports: [{ id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' }],
    });

    expect(await screen.findByText('Scatter Plot')).toBeInTheDocument();
  });

  it('filters by name as the user types', async () => {
    renderModal({
      reports: [
        { id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' },
        { id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' },
      ],
    });

    await userEvent.type(reportSearch(), 'alph');

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Beta' })).not.toBeInTheDocument();
  });

  it('matches on report type too', async () => {
    renderModal({ reports: [{ id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' }] });

    await userEvent.type(reportSearch(), 'table');

    expect(screen.getByRole('button', { name: 'Beta' })).toBeInTheDocument();
  });

  it('shows a search-specific empty state when nothing matches', async () => {
    renderModal();

    await userEvent.type(reportSearch(), 'zzz');

    expect(screen.getByText(/No reports match/)).toBeInTheDocument();
  });

  it('selects the top filtered report on Enter', async () => {
    const { onSelect } = renderModal({
      reports: [
        { id: 'a', name: 'Alpha', queryParams: 'primaryReportType=due' },
        { id: 'b', name: 'Beta', queryParams: 'primaryReportType=table' },
      ],
    });

    await userEvent.type(reportSearch(), 'alph');
    await userEvent.keyboard('{Enter}');

    expect(onSelect).toHaveBeenCalledWith('a');
  });

  // See spec/016-report-of-reports/009-value-report-modal Phase 6.
  it('offers both halves, labelled', async () => {
    renderModal();

    expect(await screen.findByText('Work Item Value')).toBeInTheDocument();
    expect(screen.getByText('Saved Report')).toBeInTheDocument();
  });

  it('offers the Work Item Value half even when there are no saved reports to add', async () => {
    renderModal({ reports: [] });

    // The two halves are independent: an empty saved-report list must not take the value form with it.
    expect(await screen.findByText('Work Item Value')).toBeInTheDocument();
    expect(screen.getByTestId('ror-value-add')).toBeInTheDocument();
  });

  it('leaves focus on the reports search, which owns the keyboard flow', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(reportSearch()).toHaveFocus();
  });
});

// The restructure. See spec/016-report-of-reports/009-value-report-modal § Restructure.
describe('<AddReportModal> layout', () => {
  it('offers a close control in the header, since Cancel sits below a scrolling list', async () => {
    const { onClose } = renderModal();

    await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

    expect(onClose).toHaveBeenCalled();
  });

  it('names the section being added to', async () => {
    renderModal({ destination: 'Q3 Initiative' });

    expect(await screen.findByText('Adding to Q3 Initiative')).toBeInTheDocument();
  });

  // `''` is a section that exists but hasn't been named — a different answer from "no section", and
  // still worth telling the user, since the add is going somewhere specific.
  it('still names an untitled section as the destination', async () => {
    renderModal({ destination: '' });

    expect(await screen.findByText('Adding to an untitled section')).toBeInTheDocument();
  });

  it('says nothing about a destination at the document root', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByText(/^Adding to/)).not.toBeInTheDocument();
  });

  it('counts the list so its length is legible before scrolling', async () => {
    renderModal();

    expect(await screen.findByText('2 reports')).toBeInTheDocument();
  });

  it('counts the matches instead while searching', async () => {
    renderModal();

    await userEvent.type(reportSearch(), 'alph');

    expect(screen.getByText('1 of 2')).toBeInTheDocument();
  });

  it('singularizes the count', async () => {
    renderModal({ reports: [report('a', 'Alpha')] });

    expect(await screen.findByText('1 report')).toBeInTheDocument();
  });

  /**
   * jsdom loads no stylesheet and lays nothing out, so "only the list scrolls" can't be observed — the
   * class is asserted instead, the way `AddContentRow` asserts `pointer-events-none`. What it protects
   * is real: the whole body used to scroll, carrying the search field and the entire Work Item Value half
   * off the top of the dialog while you browsed.
   */
  it('confines scrolling to the list', async () => {
    renderModal();

    const list = await screen.findByTestId('add-report-list');

    expect(list.className).toContain('overflow-y-auto');
    // The search field and the value form are outside it, so they stay put.
    expect(list).not.toContainElement(reportSearch());
    expect(list).not.toContainElement(screen.getByTestId('ror-value-add'));
  });
});

/**
 * **The layering contract, and the only automated check on it.**
 *
 * The Field control is a `@atlaskit/popup` holding a focusable search field, opened from inside
 * `@atlaskit/modal-dialog`. Three separate mechanisms have to cooperate for that to work at all —
 * a stacking layer, `react-focus-lock`, and `@atlaskit/layering` — and only the third leaves a trace
 * jsdom can see. See spec/033-column-select-redesign § 8 and § 11.
 *
 * **Honest caveat: jsdom can tell you Escape did not close the modal, not that the panel painted
 * above it.** Z-order is Storybook-only (§ 13).
 */
describe('<AddReportModal> and the field picker inside it', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => localStorage.clear());

  it('opens the field panel, and one Escape closes the panel without closing the dialog', async () => {
    const { onClose } = renderModal();

    await userEvent.click(await screen.findByLabelText('Field'));

    expect(screen.getByTestId('ror-field-popover')).toBeInTheDocument();

    // `Popup` closes on Escape from a **window** keydown listener, and `@atlaskit/layering` is what
    // stops the same press also closing the dialog: `Modal` wraps in `<Layering>` (level 1) and
    // `Popup` wraps its open content in another (level 2), so the modal's `useCloseOnEscapePress`
    // bails on `isLayerDisabled()`. The panel's own handler deliberately writes no Escape case and
    // above all no `stopPropagation` — that would stop the event ever reaching `window`.
    fireEvent.keyDown(screen.getByTestId('ror-field-search'), { key: 'Escape' });

    expect(screen.queryByTestId('ror-field-popover')).not.toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  /**
   * The other half of that contract, and the regression `useCloseOnEscapeBeforeAnyLayer` could
   * cause: its `window` listener is installed **only while the panel is open**, so with the panel
   * closed Escape has to reach the dialog exactly as it always did.
   */
  it('still closes the dialog on Escape when the field panel is not open', async () => {
    const { onClose } = renderModal();

    await screen.findByLabelText('Field');
    fireEvent.keyDown(screen.getByPlaceholderText('Search reports by name or type…'), { key: 'Escape' });

    expect(onClose).toHaveBeenCalled();
  });

  // Deliberately **not** tested: "↑/↓ still work in the reports search while the panel is open".
  // With focus held inside the panel the reports search never receives the event, so such a test
  // would only prove the harness dispatched to a node of its own choosing. What actually keeps the
  // two keyboard flows apart is structural: `useReportSearch`'s handler is a React `onKeyDown` on
  // the reports `<Textfield>`, and the panel is a sibling subtree, not a descendant of it.
});
