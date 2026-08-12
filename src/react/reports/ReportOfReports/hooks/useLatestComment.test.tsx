import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { useLatestComment } from './useLatestComment';

/** Records what the hook asked Jira for, so both requests' shapes can be asserted. */
let searches: Array<{ jql: string; fields: string[]; maxResults?: number }> = [];
let commentKeys: string[] = [];

const adf = (text: string) => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

const comment = (text: string) => ({
  body: adf(text),
  author: { displayName: 'Dana Ruiz' },
  // Jira sets `updated` equal to `created` on a comment nobody has edited, which is the ordinary case.
  created: '2026-08-04T14:22:00.000+0000',
  updated: '2026-08-04T14:22:00.000+0000',
});

interface Responses {
  /** Rows the search returns, or an Error to throw. */
  search?: unknown;
  /** The comment page the comment endpoint returns, or an Error to throw. */
  comments?: unknown;
}

const makeJira = ({
  search = [{ key: 'ABC-1', fields: {} }],
  comments = { comments: [comment('Blocked.')] },
}: Responses) =>
  ({
    fetchJiraIssuesWithJQLWithNamedFields: async (params: any) => {
      searches.push(params);

      if (search instanceof Error) {
        throw search;
      }

      return search;
    },
    fetchLatestComment: async (issueKey: string) => {
      commentKeys.push(issueKey);

      if (comments instanceof Error) {
        throw comments;
      }

      return comments;
    },
  }) as unknown as Jira;

const Probe: FC<{ jql: string }> = ({ jql }) => {
  const state = useLatestComment(jql);

  return (
    <div data-testid="state" data-status={state.status}>
      {state.status === 'ok'
        ? `${state.author} · ${state.updated} · ${JSON.stringify(state.body)}`
        : state.status === 'error'
          ? state.message
          : state.status}
    </div>
  );
};

const renderHook = (jql: string, jira: Jira) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  return render(
    <Wrapper>
      <Probe jql={jql} />
    </Wrapper>,
  );
};

const state = () => screen.getByTestId('state');

const settled = async () => {
  await waitFor(() => expect(state()).not.toHaveAttribute('data-status', 'loading'));

  return state();
};

// See spec/016-report-of-reports/007-latest-comment-report Phase 2.
describe('useLatestComment', () => {
  beforeEach(() => {
    searches = [];
    commentKeys = [];
  });

  it('resolves the newest comment through the key the search found', async () => {
    renderHook('issue = ABC-1', makeJira({}));

    const settledState = await settled();

    expect(settledState).toHaveAttribute('data-status', 'ok');
    expect(settledState).toHaveTextContent('Dana Ruiz');
    expect(settledState).toHaveTextContent('2026-08-04T14:22:00.000+0000');
    expect(settledState).toHaveTextContent('Blocked.');
  });

  // Step 1 exists to name the work item; step 2 is keyed by what it found, not by the JQL.
  it('passes the search result key to the comment endpoint', async () => {
    renderHook(
      'assignee = currentUser() AND updated > -1d',
      makeJira({ search: [{ key: 'SYSTEMS-918', fields: {} }] }),
    );

    await settled();

    expect(searches).toEqual([
      { jql: 'assignee = currentUser() AND updated > -1d', fields: ['summary'], maxResults: 2 },
    ]);
    expect(commentKeys).toEqual(['SYSTEMS-918']);
  });

  // Two rows is all it takes to tell "exactly one" from "more than one".
  it('asks for two rows so cardinality is knowable', async () => {
    renderHook('issue = ABC-1', makeJira({}));

    await settled();

    expect(searches[0].maxResults).toBe(2);
  });

  it('reports no match with the same copy an inline value uses', async () => {
    renderHook('issue = NOPE-1', makeJira({ search: [] }));

    expect(await settled()).toHaveTextContent('No work item matched.');
    expect(state()).toHaveAttribute('data-status', 'error');
    expect(commentKeys).toEqual([]);
  });

  it('reports more than one match without claiming a count', async () => {
    renderHook(
      'project = ABC',
      makeJira({
        search: [
          { key: 'ABC-1', fields: {} },
          { key: 'ABC-2', fields: {} },
        ],
      }),
    );

    expect(await settled()).toHaveTextContent('More than one work item matched — narrow the query.');
    expect(commentKeys).toEqual([]);
  });

  it('reports a work item with no comments as empty, not as an error', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: { comments: [], total: 0 } }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  it('treats a missing comments array as empty', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: {} }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  it('surfaces a rejected query', async () => {
    renderHook('nonsense =', makeJira({ search: new Error('Field nonsense does not exist') }));

    expect(await settled()).toHaveTextContent('Jira rejected this query: Field nonsense does not exist');
  });

  // A 404 on the comment endpoint — the work item resolved, its comments didn't.
  it('surfaces a failure to read comments, naming the key', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: new Error('Not Found') }));

    expect(await settled()).toHaveTextContent("Jira couldn't return comments for ABC-1.");
  });

  it('asks Jira nothing while the JQL is blank', async () => {
    renderHook('', makeJira({}));

    expect(state()).toHaveAttribute('data-status', 'loading');
    expect(searches).toEqual([]);
    expect(commentKeys).toEqual([]);
  });

  it('falls back to a placeholder author rather than blanking the comment', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: { comments: [{ body: adf('Hi'), created: '2026-01-01' }] } }));

    expect(await settled()).toHaveTextContent('Unknown');
  });

  // The view labels this line "Last updated", so an edited comment has to report when it was edited.
  it('reports when the comment was last edited, not when it was written', async () => {
    renderHook(
      'issue = ABC-1',
      makeJira({
        comments: {
          comments: [
            { body: adf('Hi'), created: '2026-08-01T09:00:00.000+0000', updated: '2026-08-04T14:22:00.000+0000' },
          ],
        },
      }),
    );

    const settledState = await settled();

    expect(settledState).toHaveTextContent('2026-08-04T14:22:00.000+0000');
    expect(settledState).not.toHaveTextContent('2026-08-01T09:00:00.000+0000');
  });

  // Jira has always sent both, but a comment page that somehow carries only `created` should date the
  // comment rather than lose the line entirely.
  it('falls back to when it was written if Jira sends no update time', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: { comments: [{ body: adf('Hi'), created: '2026-01-01' }] } }));

    expect(await settled()).toHaveTextContent('2026-01-01');
  });
});
