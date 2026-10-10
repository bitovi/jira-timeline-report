import { afterEach, describe, expect, it, vi } from 'vitest';

import { reloadApp, resetAppReloader, setAppReloader } from './reload-app';

describe('reloadApp', () => {
  afterEach(() => {
    resetAppReloader();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('reloads the window by default — the behaviour web and Connect keep', () => {
    const reload = vi.fn();
    // window.location.reload() is unimplemented in jsdom — stub it.
    vi.stubGlobal('location', { ...window.location, reload });

    reloadApp();

    expect(reload).toHaveBeenCalledTimes(1);
  });

  it('uses the installed reloader instead, once a host provides one', () => {
    const reload = vi.fn();
    vi.stubGlobal('location', { ...window.location, reload });
    const forgeReloader = vi.fn();
    setAppReloader(forgeReloader);

    reloadApp();

    expect(forgeReloader).toHaveBeenCalledTimes(1);
    // The Forge host must never touch the iframe's own location: a self-reload loses the bridge
    // handshake and the app comes back hung.
    expect(reload).not.toHaveBeenCalled();
  });
});
