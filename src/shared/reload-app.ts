/**
 * Reloading the whole app after a change the UI cannot re-derive in place.
 *
 * Exists because `window.location.reload()` **breaks the Forge host**. The Custom UI iframe's `src`
 * is a signed, container-issued URL, and the `@forge/bridge` handshake is established when the
 * container creates the frame. A frame that reloads itself comes back without that handshake: its
 * `__ready` postMessage is never acked ("No ack for postMessage __ready in
 * https://….cdn.prod.atlassian-dev.net in 2000ms"), so every bridge call — `requestJira`,
 * `view.getContext()`, `view.createHistory()` — hangs forever and the app sits in its loading state.
 * The write itself already succeeded, which is why a *real* browser refresh comes back correct: that
 * reloads the container, and the container rebuilds the frame with a fresh handshake.
 *
 * `view.refresh()` is not the answer — it only refetches the parent page's data, and Atlassian
 * supports it solely on the Jira issue modules (action, activity, glance, context, panel). On the
 * `jira:globalPage`/`jira:projectPage` this app ships it throws "this resource's view is not
 * refreshable". `router.reload()` is the supported way to reload the host window, which is exactly
 * what the user does by hand today.
 *
 * Same indirection as `open-external.ts`, for the same reason: the call sites are shared React code
 * that knows nothing about the host. A host installs its reloader at boot; every other host keeps
 * the default and behaves exactly as it does today.
 */

type Reloader = () => void;

const defaultReloader: Reloader = () => {
  window.location.reload();
};

let reloader: Reloader = defaultReloader;

/** Installed by the host entry (see `forge.main.ts`). Hosts that own their own page never call this. */
export const setAppReloader = (next: Reloader): void => {
  reloader = next;
};

/** Test-only: module state has to be clearable between tests. */
export const resetAppReloader = (): void => {
  reloader = defaultReloader;
};

/** Reloads the app, however the current host is able to. */
export const reloadApp = (): void => {
  reloader();
};
