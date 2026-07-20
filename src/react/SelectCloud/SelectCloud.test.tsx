import type { ReactElement } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';
import type { Jira } from '../../jira-oidc-helpers';

import React from 'react';

import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

import SelectCloud from './SelectCloud';
import { JiraProvider } from '../services/jira';

// Hand-rolled fake observable, matching the pattern in LoginButton.test.tsx.
function fakeObservable<T>(value: T): CanObservable<T> {
  return {
    value,
    getData: () => value,
    get: () => value,
    on: vi.fn(),
    off: vi.fn(),
    set: vi.fn(),
  };
}

const siteA = { id: 'A', name: 'Site A' };
const siteB = { id: 'B', name: 'Site B' };

function renderContainer({
  isLoggedIn,
  resources = [],
}: {
  isLoggedIn: boolean;
  resources?: Array<{ id: string; name: string }>;
}) {
  const fetchAccessibleResources = vi.fn().mockResolvedValue(resources);
  const jira = { fetchAccessibleResources } as unknown as Jira;

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const ui: ReactElement = (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>
        <SelectCloud isLoggedInObservable={fakeObservable(isLoggedIn)} />
      </JiraProvider>
    </QueryClientProvider>
  );

  return { fetchAccessibleResources, ...render(ui) };
}

describe('<SelectCloud />', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

  it('does not fetch and renders nothing when logged out (query gate)', () => {
    const { fetchAccessibleResources, container } = renderContainer({ isLoggedIn: false });

    expect(fetchAccessibleResources).not.toHaveBeenCalled();
    expect(container).toBeEmptyDOMElement();
  });

  it('fetches when logged in and shows the current site with alternates', async () => {
    const user = userEvent.setup();
    localStorage.setItem('scopeId', 'A');

    const { fetchAccessibleResources } = renderContainer({
      isLoggedIn: true,
      resources: [siteA, siteB],
    });

    // current site renders in the pill once the query resolves
    expect(await screen.findByText('Site A')).toBeInTheDocument();
    expect(fetchAccessibleResources).toHaveBeenCalledTimes(1);

    // the other site is offered as a switch target
    await user.click(screen.getByTestId('select-cloud-trigger'));
    expect(await screen.findByText('Site B')).toBeInTheDocument();
  });

  it('writes the chosen scopeId to localStorage and reloads on switch', async () => {
    const user = userEvent.setup();
    const reload = vi.fn();
    // window.location.reload() is unimplemented in jsdom — stub it.
    vi.stubGlobal('location', { ...window.location, reload });
    localStorage.setItem('scopeId', 'A');

    renderContainer({ isLoggedIn: true, resources: [siteA, siteB] });

    await screen.findByText('Site A');
    await user.click(screen.getByTestId('select-cloud-trigger'));
    await user.click(await screen.findByText('Site B'));

    expect(localStorage.getItem('scopeId')).toBe('B');
    expect(reload).toHaveBeenCalledTimes(1);
  });
});
