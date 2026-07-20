import { ObservableObject, type } from '../can.js';

/**
 * Observable auth store — the single source of truth for login state.
 *
 * Extracted from the old `<jira-login>` StacheElement so login state can feed
 * both the remaining CanJS StacheElements (the `timeline-report` view) and
 * React (via `value.from(store, 'isLoggedIn')` + `useCanObservable`) during the
 * React migration.
 *
 * The store runs the auto-login state machine in its constructor. Because that
 * can settle *synchronously* (valid token / no token / `isLoggedIn` seed), a
 * consumer that subscribes to the `isResolved` change event *after*
 * construction would miss the resolution and the app would never mount. To be
 * immune to that ordering, the store exposes a `resolved` promise the bootstrap
 * gate awaits instead of subscribing to a change event.
 */
export class Login extends ObservableObject {
  static props = {
    jiraHelpers: type.Any,
    isLoggedIn: false,
    isResolved: false,
    isPending: true,
    // `resolved` settles once the initial auto-login finishes. It reflects the
    // *initial* resolution only — later login()/logout() toggling isResolved
    // does not re-settle it. The bootstrap gate awaits this instead of the
    // isResolved change event (immune to sync-vs-async resolution ordering).
    resolved: type.Any,
  };
  constructor(...args) {
    super(...args);

    let markResolved;
    this.resolved = new Promise((resolve) => {
      markResolved = resolve;
    });

    if (this.isLoggedIn) {
      // isAlwaysLoggedIn seed (Connect / `jira` host): short-circuit auto-login.
      this.isResolved = true;
      this.isPending = false;
      markResolved();
    } else if (this.jiraHelpers.hasAccessToken()) {
      // if someone had a token, always automatically log them in
      if (this.jiraHelpers.hasValidAccessToken()) {
        this.isLoggedIn = true;
        this.isResolved = true;
        this.isPending = false;
        markResolved();
      } else {
        this.jiraHelpers.getAccessToken().then(() => {
          this.isLoggedIn = true;
          this.isResolved = true;
          this.isPending = false;
          markResolved();
        });
      }
    } else {
      this.isLoggedIn = false;
      this.isResolved = true;
      this.isPending = false;
      markResolved();
    }
  }
  login() {
    this.isResolved = false;
    this.isPending = true;
    this.jiraHelpers.getAccessToken().then(() => {
      this.isLoggedIn = true;
      this.isResolved = true;
      this.isPending = false;
    });
  }
  logout() {
    this.isPending = true;
    this.jiraHelpers.clearAuthFromLocalStorage();
    this.isLoggedIn = false;
    // Preserve the quirk: logout resets isResolved to false (intentional-looking
    // behavior consumers may depend on — do not "fix").
    this.isResolved = false;
    this.isPending = false;
  }
}
