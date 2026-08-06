import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';
import type { JiraIssuePickerResponse, JiraIssuePickerSection } from '../../../../jira-oidc-helpers/jira';

import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { useWorkItemSearch } from './useWorkItemSearch';

/** Every query the hook actually sent, in order — the debounce assertions read this. */
let queries: string[] = [];

const makeJira = (respond: (query: string) => JiraIssuePickerResponse | Error): Jira =>
  ({
    fetchIssuePickerSuggestions: async (query: string) => {
      queries.push(query);

      const response = respond(query);

      if (response instanceof Error) {
        throw response;
      }

      return response;
    },
  }) as unknown as Jira;

const section = (id: string, keys: string[]): JiraIssuePickerSection => ({
  id,
  issues: keys.map((key) => ({ key, summary: `<b>${key}</b>`, summaryText: `Summary of ${key}` })),
});

const Probe: FC<{ query: string }> = ({ query }) => {
  const { suggestions, isLoading } = useWorkItemSearch(query);

  return (
    <div data-testid="state" data-loading={isLoading}>
      {suggestions.map((s) => `${s.key}|${s.summary}`).join(',')}
    </div>
  );
};

const renderProbe = (query: string, jira: Jira) => {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  const view = render(
    <Wrapper>
      <Probe query={query} />
    </Wrapper>,
  );

  return {
    ...view,
    retype: (next: string) =>
      view.rerender(
        <Wrapper>
          <Probe query={next} />
        </Wrapper>,
      ),
  };
};

const state = () => screen.getByTestId('state');

const settled = async () => waitFor(() => expect(state()).toHaveAttribute('data-loading', 'false'));

describe('useWorkItemSearch', () => {
  beforeEach(() => {
    queries = [];
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('merges both sections and dedupes by key, keeping the plain summary', async () => {
    renderProbe(
      'ABC',
      makeJira(() => ({ sections: [section('cs', ['ABC-1', 'ABC-2']), section('hs', ['ABC-1'])] })),
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await settled();

    // `ABC-1` appears in both sections and is offered once; `summaryText` wins over the `<b>`-marked
    // `summary`, which would otherwise render as literal markup in an option label.
    expect(state()).toHaveTextContent('ABC-1|Summary of ABC-1,ABC-2|Summary of ABC-2');
  });

  it('collapses keystrokes into one request', async () => {
    // Mounts empty, as the real form does, so the first entry below is the recently-viewed query.
    const { retype } = renderProbe(
      '',
      makeJira(() => ({ sections: [section('cs', ['ABC-1'])] })),
    );

    retype('A');
    retype('AB');
    retype('ABC');

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await settled();

    expect(queries).toEqual(['', 'ABC']);
  });

  it('asks on the empty query too, for the recently-viewed list', async () => {
    renderProbe(
      '',
      makeJira(() => ({ sections: [section('hs', ['RECENT-1'])] })),
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await settled();

    expect(queries).toEqual(['']);
    expect(state()).toHaveTextContent('RECENT-1|Summary of RECENT-1');
  });

  it('reports loading while the typed query is still ahead of the debounced one', async () => {
    const { retype } = renderProbe(
      '',
      makeJira(() => ({ sections: [] })),
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await settled();

    retype('ABC');

    // Nothing has been asked yet, but the field must not look settled on stale results.
    expect(state()).toHaveAttribute('data-loading', 'true');
  });

  it('leaves the form usable when Jira rejects the request', async () => {
    renderProbe(
      'ABC',
      makeJira(() => new Error('boom')),
    );

    await act(async () => {
      vi.advanceTimersByTime(300);
    });
    await settled();

    // No throw, no suspend — just no help choosing a work item.
    expect(state()).toHaveTextContent('');
  });
});
