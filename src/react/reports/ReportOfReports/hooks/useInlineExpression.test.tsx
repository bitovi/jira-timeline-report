import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { useInlineExpression } from './useInlineExpression';

const catalog = [
  { id: 'summary', name: 'Summary', schema: { type: 'string' }, clauseNames: ['summary'] },
  { id: 'customfield_10014', name: 'Story points', schema: { type: 'number' }, clauseNames: ['Story Points'] },
];

// `useJiraIssueFields` fetches the catalog with `useSuspenseQuery`; stub it so these tests exercise the
// expression path rather than React Query's suspense plumbing.
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => catalog,
}));

/** Records what the hook asked Jira for, so the request shape can be asserted. */
let requests: Array<{ jql: string; fields: string[]; maxResults?: number }> = [];

const makeJira = (respond: (params: any) => unknown): Jira =>
  ({
    fetchJiraIssuesWithJQLWithNamedFields: async (params: any) => {
      requests.push(params);

      const response = respond(params);

      if (response instanceof Error) {
        throw response;
      }

      return response;
    },
  }) as unknown as Jira;

const Probe: FC<{ expression: string }> = ({ expression }) => {
  const state = useInlineExpression(expression);

  return (
    <div data-testid="state" data-status={state.status}>
      {state.status === 'ok' ? JSON.stringify(state.value) : state.status === 'error' ? state.message : 'loading'}
    </div>
  );
};

const renderHook = (expression: string, jira: Jira) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  return render(
    <Wrapper>
      <Probe expression={expression} />
    </Wrapper>,
  );
};

const state = () => screen.getByTestId('state');

const settled = async () => {
  await waitFor(() => expect(state()).not.toHaveAttribute('data-status', 'loading'));

  return state();
};

const issue = (fields: Record<string, unknown>) => ({ key: 'ABC-1', fields });

// See spec/016-report-of-reports/003-self-reports Phase 3.
describe('useInlineExpression', () => {
  beforeEach(() => {
    requests = [];
  });

  it('resolves a value from a single match', async () => {
    renderHook(
      '(issue = ABC-1).summary',
      makeJira(() => [issue({ Summary: 'Migrate auth to OIDC' })]),
    );

    expect(await settled()).toHaveTextContent('Migrate auth to OIDC');
    expect(state()).toHaveAttribute('data-status', 'ok');
  });

  // The two halves of the expression become the two arguments of the existing search call.
  it('asks Jira for the parsed JQL and the resolved field id', async () => {
    renderHook(
      '(project = A AND (x = 1)).Story points',
      makeJira(() => [issue({ 'Story points': 8 })]),
    );

    await settled();

    expect(requests).toEqual([{ jql: 'project = A AND (x = 1)', fields: ['customfield_10014'], maxResults: 2 }]);
  });

  it('reads a value that came back under the raw field id', async () => {
    renderHook(
      '(issue = ABC-1).Story points',
      makeJira(() => [issue({ customfield_10014: 13 })]),
    );

    expect(await settled()).toHaveTextContent('13');
  });

  it('surfaces a parse error without asking Jira anything', async () => {
    renderHook(
      'issue = ABC-1',
      makeJira(() => []),
    );

    expect(state()).toHaveAttribute('data-status', 'error');
    expect(state()).toHaveTextContent(/starts with "\("/);
    expect(requests).toEqual([]);
  });

  it('surfaces an unknown field without asking Jira anything', async () => {
    renderHook(
      '(issue = ABC-1).nope',
      makeJira(() => []),
    );

    expect(state()).toHaveAttribute('data-status', 'error');
    expect(state()).toHaveTextContent(/No Jira field named "nope"/);
    expect(requests).toEqual([]);
  });

  it('reports no match', async () => {
    renderHook(
      '(issue = NOPE-1).summary',
      makeJira(() => []),
    );

    expect(await settled()).toHaveTextContent('No work item matched.');
  });

  // `maxResults: 2` caps the response, so the message says "more than one" rather than a count.
  it('reports more than one match without claiming a count', async () => {
    renderHook(
      '(project = A).summary',
      makeJira(() => [issue({ Summary: 'one' }), issue({ Summary: 'two' })]),
    );

    const settledState = await settled();

    expect(settledState).toHaveTextContent(/More than one work item matched/);
    expect(settledState).not.toHaveTextContent(/\d/);
  });

  it('surfaces a rejected query', async () => {
    renderHook(
      '(bad jql).summary',
      makeJira(() => new Error('400 Bad Request')),
    );

    expect(await settled()).toHaveTextContent('Jira rejected this query: 400 Bad Request');
  });

  it('starts out loading', () => {
    renderHook(
      '(issue = ABC-1).summary',
      makeJira(() => [issue({ Summary: 'later' })]),
    );

    expect(state()).toHaveAttribute('data-status', 'loading');
  });
});
