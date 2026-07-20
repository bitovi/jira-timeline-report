import { describe, it, expect, vi } from 'vitest';

import { value } from '../can.js';
import { Login } from './login.js';

/**
 * Build a mock `jiraHelpers` with the 4 methods the store depends on.
 * Defaults represent the "no token" state; override per test.
 */
function makeJiraHelpers(overrides = {}) {
  return {
    hasAccessToken: vi.fn(() => false),
    hasValidAccessToken: vi.fn(() => false),
    getAccessToken: vi.fn(() => Promise.resolve()),
    clearAuthFromLocalStorage: vi.fn(),
    ...overrides,
  };
}

// Flush the microtask queue so promise `.then()` callbacks inside the store run.
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('Login store', () => {
  describe('auto-login (constructor state machine)', () => {
    it('no token → resolved, not logged in, not pending', () => {
      const jiraHelpers = makeJiraHelpers();
      const store = new Login({ jiraHelpers });

      expect(store.isResolved).toBe(true);
      expect(store.isLoggedIn).toBe(false);
      expect(store.isPending).toBe(false);
      expect(jiraHelpers.getAccessToken).not.toHaveBeenCalled();
    });

    it('valid token → logged in + resolved synchronously', () => {
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => true),
      });
      const store = new Login({ jiraHelpers });

      // synchronous — no await needed
      expect(store.isLoggedIn).toBe(true);
      expect(store.isResolved).toBe(true);
      expect(store.isPending).toBe(false);
      expect(jiraHelpers.getAccessToken).not.toHaveBeenCalled();
    });

    it('stale token → refreshes then logs in / resolves', async () => {
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => false),
      });
      const store = new Login({ jiraHelpers });

      expect(jiraHelpers.getAccessToken).toHaveBeenCalledTimes(1);
      // not yet resolved until the refresh promise settles
      expect(store.isLoggedIn).toBe(false);

      await flush();

      expect(store.isLoggedIn).toBe(true);
      expect(store.isResolved).toBe(true);
      expect(store.isPending).toBe(false);
    });

    it('isAlwaysLoggedIn seed short-circuits auto-login', () => {
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => true),
      });
      const store = new Login({ jiraHelpers, isLoggedIn: true });

      expect(store.isLoggedIn).toBe(true);
      expect(store.isResolved).toBe(true);
      expect(store.isPending).toBe(false);
      // seed means we never consult the token helpers
      expect(jiraHelpers.hasAccessToken).not.toHaveBeenCalled();
      expect(jiraHelpers.getAccessToken).not.toHaveBeenCalled();
    });
  });

  describe('login()', () => {
    it('is pending immediately, then logged in + resolved', async () => {
      const jiraHelpers = makeJiraHelpers();
      const store = new Login({ jiraHelpers });

      store.login();

      expect(store.isPending).toBe(true);
      expect(store.isResolved).toBe(false);
      expect(jiraHelpers.getAccessToken).toHaveBeenCalledTimes(1);

      await flush();

      expect(store.isLoggedIn).toBe(true);
      expect(store.isResolved).toBe(true);
      expect(store.isPending).toBe(false);
    });
  });

  describe('logout()', () => {
    it('clears auth and resets flags (incl. isResolved quirk)', () => {
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => true),
      });
      const store = new Login({ jiraHelpers });
      expect(store.isLoggedIn).toBe(true);
      expect(store.isResolved).toBe(true);

      store.logout();

      expect(jiraHelpers.clearAuthFromLocalStorage).toHaveBeenCalledTimes(1);
      expect(store.isLoggedIn).toBe(false);
      // preserve the quirk: logout resets isResolved to false
      expect(store.isResolved).toBe(false);
      expect(store.isPending).toBe(false);
    });
  });

  describe('observable contract (what the ~9 CanObservable consumers depend on)', () => {
    it('value.from(store, "isLoggedIn").on(cb) fires on change', async () => {
      const jiraHelpers = makeJiraHelpers();
      const store = new Login({ jiraHelpers });

      const observable = value.from(store, 'isLoggedIn');
      const cb = vi.fn();
      observable.on(cb);

      expect(observable.value).toBe(false);

      store.login();
      await flush();

      expect(cb).toHaveBeenCalled();
      expect(observable.value).toBe(true);

      observable.off(cb);
    });

    it('store.on("isLoggedIn", cb) fires on change', async () => {
      const jiraHelpers = makeJiraHelpers();
      const store = new Login({ jiraHelpers });

      const cb = vi.fn();
      store.on('isLoggedIn', cb);

      store.login();
      await flush();

      expect(cb).toHaveBeenCalled();
      expect(store.isLoggedIn).toBe(true);

      store.off('isLoggedIn', cb);
    });
  });

  describe('resolution-race regression (bootstrap gate)', () => {
    it('resolved promise settles even for synchronous constructor resolution', async () => {
      // valid token => the store resolves *synchronously* in the constructor.
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => true),
      });
      const store = new Login({ jiraHelpers });

      // A gate that awaits `resolved` *after* construction must still be
      // notified — a plain `.on()` subscription would have missed it.
      const gate = vi.fn();
      await store.resolved.then(gate);

      expect(gate).toHaveBeenCalledTimes(1);
      expect(store.isResolved).toBe(true);
      expect(store.isLoggedIn).toBe(true);
    });

    it('resolved promise settles for the async (stale token) path', async () => {
      const jiraHelpers = makeJiraHelpers({
        hasAccessToken: vi.fn(() => true),
        hasValidAccessToken: vi.fn(() => false),
      });
      const store = new Login({ jiraHelpers });

      await store.resolved;

      expect(store.isResolved).toBe(true);
      expect(store.isLoggedIn).toBe(true);
    });
  });
});
