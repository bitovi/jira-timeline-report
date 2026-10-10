import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createForgeRouting } from './index.forge';
import { view } from '@forge/bridge';

vi.mock('@forge/bridge', () => ({
  view: { createHistory: vi.fn() },
}));

/**
 * A stand-in for the `history` object `view.createHistory()` returns. Only `location` and `replace`
 * are exercised by the mirror, and `replace` is what the container would see.
 */
const fakeForgeHistory = (search: string, pathname = '/container') => {
  const replace = vi.fn();

  return {
    history: { location: { pathname, search, hash: '', state: null, key: 'x' }, replace },
    replace,
  };
};

const givenContainerSearch = (search: string, pathname?: string) => {
  const { history, replace } = fakeForgeHistory(search, pathname);
  vi.mocked(view.createHistory).mockResolvedValue(history as never);

  return { replace };
};

describe('forge routing mirror', () => {
  const originalPushState = history.pushState;

  beforeEach(() => {
    history.replaceState(null, '', '/');
  });

  afterEach(() => {
    // `syncRouters` patches the global on purpose, so every test has to hand it back.
    history.pushState = originalPushState;
    vi.clearAllMocks();
  });

  describe('reconcileRoutingState — container to app', () => {
    it("seeds the iframe URL from the container's search", async () => {
      givenContainerSearch('?jql=project%3DTEST&primaryReportType=start-due');

      const routing = await createForgeRouting();
      routing.reconcileRoutingState();

      expect(window.location.search).toBe('?jql=project%3DTEST&primaryReportType=start-due');
    });

    it("clears Forge's own platform params off the iframe URL", async () => {
      // The iframe `src` arrives carrying these; `route.start()` would otherwise read them as app
      // state. Replacing the whole search string is what removes them.
      history.replaceState(null, '', '/?platformFeatureFlags=forge-ui-iframe-analytics');
      givenContainerSearch('?report=abc');

      const routing = await createForgeRouting();
      routing.reconcileRoutingState();

      expect(window.location.search).toBe('?report=abc');
      expect(window.location.search).not.toContain('platformFeatureFlags');
    });

    it('falls back to the pathname when the container carries no state, rather than a bare "?"', async () => {
      history.replaceState(null, '', '/?platformFeatureFlags=analytics');
      givenContainerSearch('');

      const routing = await createForgeRouting();
      routing.reconcileRoutingState();

      expect(window.location.search).toBe('');
      expect(window.location.href).not.toContain('?');
    });
  });

  describe('syncRouters — app to container', () => {
    it("echoes the app's new search into the container, keeping the container pathname", async () => {
      const { replace } = givenContainerSearch('', '/jira/apps/status-reports');

      const routing = await createForgeRouting();
      routing.syncRouters();

      history.pushState(null, '', '?report=abc&jql=project%3DTEST');

      expect(replace).toHaveBeenCalledWith({
        pathname: '/jira/apps/status-reports',
        search: '?report=abc&jql=project%3DTEST',
      });
    });

    it("still performs the app's own pushState", async () => {
      givenContainerSearch('');

      const routing = await createForgeRouting();
      routing.syncRouters();

      history.pushState(null, '', '?report=abc');

      expect(window.location.search).toBe('?report=abc');
    });

    it('round-trips a long report URL without truncating it', async () => {
      // Report configuration runs to hundreds of characters. Our own code must not be what loses
      // it — whether the *platform* preserves it is only answerable against a real site.
      const longSearch = '?' + Array.from({ length: 40 }, (_, i) => `param${i}=${'v'.repeat(20)}`).join('&');
      const { replace } = givenContainerSearch('');

      const routing = await createForgeRouting();
      routing.syncRouters();

      history.pushState(null, '', longSearch);

      expect(longSearch.length).toBeGreaterThan(1000);
      expect(replace).toHaveBeenCalledWith(expect.objectContaining({ search: longSearch }));
    });
  });
});
