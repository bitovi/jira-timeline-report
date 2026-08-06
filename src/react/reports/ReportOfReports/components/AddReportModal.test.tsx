import type { FC, ReactNode } from 'react';
import type { Report } from '../../../../jira/reports';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { AddReportModal } from './AddReportModal';

// The Value Report half fetches; the saved-report half — which is what these tests are about — does
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
 * The reports search, by placeholder rather than by role: the Value Report row puts a second textbox in
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

    expect(await screen.findByText('Value Report')).toBeInTheDocument();
    expect(screen.getByText('Saved Report')).toBeInTheDocument();
  });

  it('offers the Value Report half even when there are no saved reports to add', async () => {
    renderModal({ reports: [] });

    // The two halves are independent: an empty saved-report list must not take the value form with it.
    expect(await screen.findByText('Value Report')).toBeInTheDocument();
    expect(screen.getByTestId('ror-value-add')).toBeInTheDocument();
  });

  it('leaves focus on the reports search, which owns the keyboard flow', async () => {
    renderModal();

    expect(await screen.findByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(reportSearch()).toHaveFocus();
  });
});
