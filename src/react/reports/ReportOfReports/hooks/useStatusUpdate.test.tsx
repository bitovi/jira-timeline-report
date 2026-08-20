import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { useStatusUpdate } from './useStatusUpdate';

/** Records what the hook asked Jira for, so both requests' shapes can be asserted. */
let searches: Array<{ jql: string; fields: string[]; maxResults?: number }> = [];
let commentKeys: string[] = [];

const adf = (text: string) => ({
  type: 'doc',
  version: 1,
  content: [{ type: 'paragraph', content: [{ type: 'text', text }] }],
});

// Thursday of the week the clock is pinned to — Monday 2026-08-17 to Monday 2026-08-24, UTC.
const THIS_WEEK = '2026-08-20T14:22:00.000+0000';
const LAST_WEEK = '2026-08-13T14:22:00.000+0000';

const comment = (text: string, times: { created?: string; updated?: string } = {}) => {
  const created = times.created ?? THIS_WEEK;

  return { body: adf(text), author: { displayName: 'Dana Ruiz' }, created, updated: times.updated ?? created };
};

interface Responses {
  /** Rows the search returns, or an Error to throw. */
  search?: unknown;
  /** The comment page the comment endpoint returns, or an Error to throw. */
  comments?: unknown;
}

const makeJira = ({
  search = [{ key: 'ABC-1', fields: {} }],
  comments = { comments: [comment('Status Update: shipped the auth refactor')] },
}: Responses) =>
  ({
    fetchJiraIssuesWithJQLWithNamedFields: async (params: any) => {
      searches.push(params);

      if (search instanceof Error) {
        throw search;
      }

      return search;
    },
    fetchRecentComments: async (issueKey: string) => {
      commentKeys.push(issueKey);

      if (comments instanceof Error) {
        throw comments;
      }

      return comments;
    },
  }) as unknown as Jira;

const Probe: FC<{ jql: string }> = ({ jql }) => {
  const state = useStatusUpdate(jql);

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

// See spec/027-status-updates § The hook.
describe('useStatusUpdate', () => {
  beforeEach(() => {
    searches = [];
    commentKeys = [];
    // The one place a clock is read — `weekContaining(Date.now())`. `shouldAdvanceTime` keeps React
    // Query's own timers and `waitFor` running in real time while the date is pinned.
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date('2026-08-20T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("resolves this week's status update through the key the search found", async () => {
    renderHook('issue = ABC-1', makeJira({}));

    const settledState = await settled();

    expect(settledState).toHaveAttribute('data-status', 'ok');
    expect(settledState).toHaveTextContent('Dana Ruiz');
    expect(settledState).toHaveTextContent(THIS_WEEK);
    expect(settledState).toHaveTextContent('Status Update: shipped the auth refactor');
  });

  // Step 1 is `useResolvedIssueKey`, shared with `useLatestComment`: the search names the work item and
  // step 2 is keyed by what it found, not by the JQL.
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

  // The behaviour the whole feature exists for: an unrelated comment posted after the update does not
  // displace it, which is exactly what Latest Comment cannot promise.
  it('is not displaced by a newer unrelated comment', async () => {
    const comments = {
      // `-created` order, as Jira returns it.
      comments: [
        comment('can you rebase this?', { created: '2026-08-21T09:00:00.000+0000' }),
        comment('Status Update: still on the cert', { created: '2026-08-19T09:00:00.000+0000' }),
      ],
    };

    renderHook('issue = ABC-1', makeJira({ comments }));

    const settledState = await settled();

    expect(settledState).toHaveAttribute('data-status', 'ok');
    expect(settledState).toHaveTextContent('Status Update: still on the cert');
  });

  it('prefers the update with the newer updated, not the newer created', async () => {
    const comments = {
      comments: [
        comment('Status Update: first draft', { created: '2026-08-20T09:00:00.000+0000' }),
        comment('Status Update: corrected', {
          created: '2026-08-18T09:00:00.000+0000',
          updated: '2026-08-21T09:00:00.000+0000',
        }),
      ],
    };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveTextContent('Status Update: corrected');
  });

  // Membership is `created`: editing an old update doesn't move it into this week. `updated` only
  // chooses between the updates the week already has.
  it('ignores an old comment edited into this week', async () => {
    const comments = {
      comments: [comment('Status Update: revised', { created: '2026-06-01T09:00:00.000+0000', updated: THIS_WEEK })],
    };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  // The mirror: posted in the week, corrected after it — still the week's update.
  it('keeps an update posted this week and edited later', async () => {
    const comments = {
      comments: [
        comment('Status Update: corrected', {
          created: '2026-08-19T09:00:00.000+0000',
          updated: '2026-08-27T09:00:00.000+0000',
        }),
      ],
    };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveTextContent('Status Update: corrected');
  });

  // One `empty` for both nothings: the reader is told the same true thing either way.
  it('is empty when the only matching update is from last week', async () => {
    const comments = { comments: [comment('Status Update: last week', { created: LAST_WEEK })] };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  it('is empty when this week has comments but none of them is an update', async () => {
    const comments = { comments: [comment('looks good'), comment('merged')] };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  it('is empty when the work item has no comments at all', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: { comments: [], total: 0 } }));

    expect(await settled()).toHaveAttribute('data-status', 'empty');
  });

  // The three failures step 1 owns, worded identically to an ordinary inline value's.
  it('reports a query that matched nothing, and asks for no comments', async () => {
    renderHook('issue = NOPE-1', makeJira({ search: [] }));

    const settledState = await settled();

    expect(settledState).toHaveAttribute('data-status', 'error');
    expect(settledState).toHaveTextContent('No work item matched.');
    expect(commentKeys).toEqual([]);
  });

  it('reports a query that matched more than one', async () => {
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

  it('reports a rejected query', async () => {
    renderHook('nonsense', makeJira({ search: new Error('bad JQL') }));

    expect(await settled()).toHaveTextContent('Jira rejected this query: bad JQL');
  });

  it('reports a comment endpoint that failed, naming the work item', async () => {
    renderHook('issue = ABC-1', makeJira({ comments: new Error('boom') }));

    expect(await settled()).toHaveTextContent("Jira couldn't return comments for ABC-1.");
  });

  it('asks Jira nothing for a blank JQL', async () => {
    renderHook('', makeJira({}));

    expect(state()).toHaveAttribute('data-status', 'loading');
    expect(searches).toEqual([]);
    expect(commentKeys).toEqual([]);
  });

  it('names Unknown rather than leaving the author line blank', async () => {
    const comments = { comments: [{ body: adf('Status Update: fine'), created: THIS_WEEK, updated: THIS_WEEK }] };

    renderHook('issue = ABC-1', makeJira({ comments }));

    expect(await settled()).toHaveTextContent('Unknown');
  });
});
