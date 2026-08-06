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

const jira = {
  fetchIssuePickerSuggestions: async () => ({
    sections: [{ id: 'cs', issues: [{ key: 'ABC-1', summaryText: 'Migrate auth to OIDC' }] }],
  }),
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
  // arrive before it can be clicked.
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'ABC' } });
  fireEvent.click(await screen.findByText('ABC-1 — Migrate auth to OIDC'));
};

const pickField = (label: string) => {
  fireEvent.click(screen.getByText('Field'));
  fireEvent.click(screen.getByText(label));
};

// See spec/016-report-of-reports/009-value-report-modal Phase 4.
describe('<ValueReportForm>', () => {
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
    expect(screen.getByText('Field')).toBeInTheDocument();
  });
});
