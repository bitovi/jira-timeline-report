/**
 * Opening a link outside the app.
 *
 * Exists because the Forge iframe's sandbox omits `allow-popups`, so `window.open` and
 * `target="_blank"` are **silently inert** — a click on a work-item link in a report does nothing at
 * all, with no error. Forge's answer is `router.open()`, which asks the container to do the
 * navigation on the app's behalf.
 *
 * The indirection is a settable module-level opener rather than a prop or a context because the
 * call sites are ~35 anchors spread across 23 files, and because some of the links are not ours at
 * all — `@atlaskit/renderer` draws the links inside rendered Jira comments, and we never see that
 * markup. A host installs its opener at boot; every other host keeps the default and behaves
 * exactly as it does today.
 */

type Opener = (url: string) => void;

const defaultOpener: Opener = (url) => {
  window.open(url, '_blank', 'noopener,noreferrer');
};

let opener: Opener = defaultOpener;

/** Installed by the host entry (see `forge.main.ts`). Hosts that can open tabs never call this. */
export const setExternalOpener = (next: Opener): void => {
  opener = next;
};

/** Test-only: module state has to be clearable between tests. */
export const resetExternalOpener = (): void => {
  opener = defaultOpener;
};

/** Opens `url` outside the app, however the current host is able to. */
export const openExternal = (url: string): void => {
  opener(url);
};

/**
 * Routes clicks on `target="_blank"` anchors through {@link openExternal}.
 *
 * Delegated from the document rather than wired per component, for two reasons: it covers the
 * anchors inside `@atlaskit/renderer`'s output, which no component of ours owns, and it leaves the
 * markup at all 35 sites untouched — so the web and Connect builds keep the plain anchors they have
 * today, right down to middle-click and "open in new tab".
 *
 * Deliberately narrow:
 * - only `a[target="_blank"]`, so SPA links (`services/routing/Link.tsx`) are never touched
 * - skips anything a component already handled (`defaultPrevented`)
 * - skips in-page fragments
 *
 * Modifier-clicks are intercepted too. On a host that needs this at all, cmd-click cannot open a
 * tab either, so letting them through would just be a second way to do nothing.
 *
 * Returns a teardown, so a test — or a host that stops needing it — can detach.
 */
export const interceptExternalLinkClicks = (target: Document = document): (() => void) => {
  const onClick = (event: MouseEvent): void => {
    if (event.defaultPrevented) {
      return;
    }

    const anchor = (event.target as Element | null)?.closest?.('a[target="_blank"]');
    const href = anchor?.getAttribute('href');

    if (!href || href.startsWith('#')) {
      return;
    }

    event.preventDefault();

    // Resolved against the document so a relative href reaches the container as something it can
    // actually navigate to.
    openExternal(new URL(href, window.location.href).href);
  };

  target.addEventListener('click', onClick);

  return () => target.removeEventListener('click', onClick);
};
