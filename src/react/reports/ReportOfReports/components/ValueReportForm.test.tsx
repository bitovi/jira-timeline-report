import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { ValueReportForm } from './ValueReportForm';

const catalog = [
  { id: 'summary', name: 'Summary' },
  { id: 'customfield_10014', name: 'Story points' },
];

// `useJiraIssueFields` is a suspense query; stub it so these tests exercise the form rather than
// React Query's suspense plumbing — the pattern `useInlineExpression.test.tsx` established.
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => catalog,
}));

/** Every query that actually reached Jira — the "don't ask on one character" assertion reads this. */
let queries: string[] = [];

const jira = {
  fetchIssuePickerSuggestions: async (query: string) => {
    queries.push(query);

    return { sections: [{ id: 'cs', issues: [{ key: 'ABC-1', summaryText: 'Migrate auth to OIDC' }] }] };
  },
} as unknown as Jira;

const renderForm = () => {
  const onAdd = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <ValueReportForm onAdd={onAdd} />
    </Wrapper>,
  );

  return { onAdd };
};

const addButton = () => screen.getByTestId('ror-value-add');

const pickWorkItem = async () => {
  // Typing is what opens react-select's menu; the suggestion list is fetched, so the option has to
  // arrive before it can be clicked. `fireEvent`, not `userEvent`: the menu portals to `document.body`
  // and repositions as it opens, which `userEvent.type`'s per-keystroke awaits can type across.
  fireEvent.change(screen.getByLabelText('Work item'), { target: { value: 'ABC' } });
  fireEvent.click(await screen.findByText('ABC-1 — Migrate auth to OIDC'));
};

const pickField = (label: string) => {
  fireEvent.keyDown(screen.getByLabelText('Field'), { key: 'ArrowDown' });
  fireEvent.click(screen.getByText(label));
};

// See spec/016-report-of-reports/009-value-report-modal Phase 4.
describe('<ValueReportForm>', () => {
  beforeEach(() => {
    queries = [];
  });

  it('keeps + disabled until both halves are chosen', async () => {
    renderForm();

    expect(addButton()).toBeDisabled();

    await pickWorkItem();
    expect(addButton()).toBeDisabled();

    pickField('Summary');
    expect(addButton()).toBeEnabled();
  });

  it('stays disabled when only a field is chosen', () => {
    renderForm();

    pickField('Summary');

    expect(addButton()).toBeDisabled();
  });

  it('emits the field id, not its display name', async () => {
    const { onAdd } = renderForm();

    await pickWorkItem();
    pickField('Story points');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('(issue = ABC-1).customfield_10014');
  });

  it('emits the latest-comment expression for the derived entry', async () => {
    const { onAdd } = renderForm();

    await pickWorkItem();
    pickField('Latest Comment');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('(issue = ABC-1).latestComment');
  });

  it('resets both halves after adding, so a second add cannot inherit the first', async () => {
    renderForm();

    await pickWorkItem();
    pickField('Summary');
    fireEvent.click(addButton());

    await waitFor(() => expect(addButton()).toBeDisabled());
    // Both selects are back to their placeholders — neither the picked field nor the picked work item
    // is still displayed anywhere.
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/ABC-1/)).not.toBeInTheDocument();
  });

  // The picker used to ask on every query including the empty one, whose `hs` section is the caller's
  // recently-viewed list — which read as a mystery list, since it is neither everything nor what you
  // typed. See `useWorkItemSearch`'s MIN_QUERY_LENGTH.
  it('shows nothing until enough is typed to search on', async () => {
    renderForm();

    expect(queries).toEqual([]);

    fireEvent.change(screen.getByLabelText('Work item'), { target: { value: 'A' } });

    expect(await screen.findByText('Keep typing…')).toBeInTheDocument();
    expect(queries).toEqual([]);
  });
});
