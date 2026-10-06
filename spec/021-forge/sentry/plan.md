# Error monitoring on Forge (Sentry, or Forge's own logs)

## Summary

**Today the Forge app reports no errors to anyone.** Sentry is switched off on the Forge host on
purpose (`FRONTEND_SENTRY_DSN: ''` in `src/forge.main.ts`), so when something breaks for a customer
in Jira we only find out if they tell us. The website and the old Connect build still use Sentry as
before.

**We can't just switch it back on.** Our Sentry setup was built for the website. Everything it
sends is "egress", meaning data leaving Atlassian. To keep the app in Atlassian's **Runs on
Atlassian** program, that data must contain no customer content. Ours would contain a lot: every
page URL holds the report's JQL, performance tracing records every Jira API call, and the
bug-report form uploads users' emails and screenshots. Turned on as-is, Sentry would lose us Runs on
Atlassian, and probably also trigger a major version that every customer admin has to approve.

**Sentry can still be used on Forge, under strict conditions.** Atlassian pre-approves Sentry as an
"analytics" tool. If we (a) declare it in the manifest under the analytics category, (b) promise it
receives no customer data, and (c) configure a much stricter, Forge-only Sentry setup that keeps
that promise, we stay eligible. That's real work, plus an ongoing commitment, plus a major version.

**The cheaper alternative uses Forge's own logs.** Forge has an Early Access Program for **frontend
logs**. It captures `console.error`, uncaught exceptions and unhandled promise rejections from our
iframe, in production, with **no code changes**, and shows them in the developer console. Nothing
leaves Atlassian, so there's no egress, no manifest change, no major version and no effect on Runs
on Atlassian. We lose Sentry's grouping, alerts and dashboards.

**There's a live bug to fix first.** The **Report a bug** and **Request a feature** forms send
through Sentry. On Forge, Sentry is off, so a customer fills in the form, sees "Thanks for the
feedback!", and **nothing is sent**. This affects every Forge customer today, and it's a small fix
(see [the feedback forms](#a-live-bug-the-feedback-forms-send-nothing-on-forge)).

**Recommendation, in order:**

1. Fix the feedback forms.
2. Sign up for the frontend-logs Early Access Program.
3. Only move to Sentry if those logs turn out not to be enough, and ship it together with some
   other release that is already a major version.

> Sub-plan of [spec/021](../plan.md). Written 5 Oct 2026, after Forge v5 (KVS storage) shipped.
>
> Status: **not started.** The feedback-form fix is the only part that is urgent.

---

## Where Sentry stands today

| Host                                   | Sentry  | Where                                                       |
| -------------------------------------- | ------- | ----------------------------------------------------------- |
| Website (`statusreports.bitovi.com`)   | On      | `src/web.main.ts:16` reads `VITE_FRONTEND_SENTRY_DSN`       |
| Connect (`plugin.main.ts`)             | On      | `src/plugin.main.ts:46`, same variable                      |
| **Forge**                              | **Off** | `src/forge.main.ts:132` hardcodes `FRONTEND_SENTRY_DSN: ''` |
| Forge resolver (`src/forge-resolver/`) | None    | no Sentry import                                            |
| Auth server (EC2)                      | On      | `BACKEND_SENTRY_DSN` in both deploy workflows               |

All three frontends share one initialiser, `src/shared/sentry.js`, called from
`src/shared/main-helper.js:39`:

```js
Sentry.init({
  dsn: FRONTEND_SENTRY_DSN,
  integrations: [Sentry.browserTracingIntegration(), Sentry.feedbackIntegration({ autoInject: false })],
  tracesSampleRate: 1.0,
  enabled: !!FRONTEND_SENTRY_DSN,
  environment: STATUS_REPORTS_ENV,
});
window.addEventListener('error', (error) => Sentry.captureException(error));
```

On Forge, `enabled: false` turns all of it into no-ops:

- `init`;
- the `window` error listener;
- every `ErrorBoundary` from `@sentry/react` (about 14 wrappers, e.g. `SettingsSidebarWrapper.tsx` and
  `SaveReportsWrapper.tsx`). They still work as React error boundaries and render their fallbacks;
  they just report nothing;
- `withProfiler` (`ConfigureTeamsWrapper.tsx`);
- `captureFeedback` (see the next section).

`@sentry/react` is still bundled into the Forge build. That costs bundle size only, with no
behaviour or egress.

**Why the empty string is hardcoded and not read from the environment:** see the comment at
`src/forge.main.ts:117-131`. In short, `scripts/generate-build-env.sh` writes a `.env` file
containing the DSN, so reading it from the environment would leave "Sentry is off on Forge" up to
whatever happened to be in `.env` at build time. Keep it hardcoded until this plan deliberately
changes it.

A separate, unrelated DSN is also in the bundle: `dist-forge/assets/RichAdf-*.js` contains
`…@o55978.ingest.sentry.io`. That's **Atlassian's own**, hardcoded in Atlaskit's `editor-common`.
We declare no egress, so the Forge content security policy blocks it, and nothing leaves Jira. No
action needed.

## A live bug: the feedback forms send nothing on Forge

`src/react/SettingsSidebar/components/ReportSettings/shared/hooks/useFeedback.tsx` submits both the
**Report a bug** form (`BugReportForm.tsx`) and the **Request a feature** form
(`FeatureRequestForm.tsx`) through Sentry's `captureFeedback`. The forms are rendered from
`ReportSettings.tsx:101,108` with no check on which host we're in.

On Forge:

- `captureFeedback` doesn't throw;
- the mutation resolves;
- `onSuccess` shows **"Thanks for the feedback!"**;
- nothing is sent.

Customers believe they've reported something and we never see it.

These forms also could never go to Sentry under the analytics rules
([below](#option-b-sentry-as-analytics-egress)). They collect an **email address, free text and file
attachments**, which is end-user data by definition. So turning Sentry on would not fix this.

**Fix (small, a minor version, do it first):** on the Forge host, don't render these forms. Show a
link to wherever Bitovi wants feedback to go instead. A plain link the user clicks isn't egress by
the app, so it needs no manifest change. The host is already known via `jira.host === 'forge'`, the
same check `useConnectMigrationStatus.ts` uses.

_Open:_ where the link should point (a support portal, an email address, GitHub issues). It's a
product decision; the code change is the same whatever the answer.

## Why turning the current Sentry setup on for Forge breaks the rules

Runs on Atlassian requires ([source](https://developer.atlassian.com/platform/forge/runs-on-atlassian/)):

> "Your app must not egress data, with the exception of egress for analytics purposes."

and analytics egress must not include **in-scope End-User Data (EUD)**. Our current config would
send EUD in at least these ways:

| What Sentry would send                                                              | Why it is customer data                                                                |
| ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| Page URLs: on every event, and on every transaction because `tracesSampleRate: 1.0` | The URL carries report state, **including the JQL**                                    |
| Tracing spans for every `fetch`                                                     | Jira REST URLs, with JQL, issue keys and field ids                                     |
| Breadcrumbs (console, fetch, navigation, UI clicks)                                 | The same URLs, plus whatever text was logged                                           |
| Exception messages and stack frame values                                           | Errors raised while handling issues can contain issue keys, summaries and field values |
| `captureFeedback`                                                                   | Email address, free text, attachments                                                  |

There are three further problems besides the data:

1. **Undeclared egress gets blocked.** Without an `external.fetch.client` entry, Forge's content
   security policy blocks requests to `*.ingest.sentry.io`, so a DSN alone would just produce blocked
   requests and console errors.
2. **Declaring it the wrong way loses Runs on Atlassian.** `inScopeEUD` defaults to `true`, and `true`
   makes the app ineligible.
3. **It's probably a major version.** The Forge versions doc (quoted in
   [ci-cd.md](../next-steps/ci-cd.md#how-a-change-actually-reaches-a-customer)) lists adding or
   changing app permissions as a major-version trigger, which means admin consent on every site. I
   didn't find anything exempting analytics egress. Treat it as major until a deploy says otherwise.

## Option A: Forge's own logs (recommended)

Nothing leaves Atlassian, so none of the egress, end-user data or Runs on Atlassian questions
apply.

### A1. The frontend-logs Early Access Program (no code)

From [View app logs](https://developer.atlassian.com/platform/forge/view-app-logs/):

- It captures **`console.error`, uncaught exceptions and unhandled promise rejections**.
- It is "supported for both UI Kit and Custom UI across all environments, **including production**".
- Logs appear in the developer console under **Logs**, kept for **30 days**.
- Limits: strings are cut at 1,024 characters, at most 5 extra arguments, objects at most 10,000
  characters serialised ([limits](https://developer.atlassian.com/platform/forge/debugging/#frontend-log-limits)).
- **You join through a sign-up form**: the
  [EAP request](https://ecosystem.atlassian.net/servicedesk/customer/portal/38/group/136/create/20612).

We already get useful logs without extra work:

- the storage adapters, `useConnectMigrationStatus` and many hooks already call `console.error` or
  throw on real failures;
- React logs errors caught by boundaries through `console.error`.

So joining the program should give useful signal straight away.

**Steps:**

1. A person signs up for the EAP with the Marketplace app id
   `ari:cloud:ecosystem::app/12573c92-9009-45d3-ab51-46f65ffa1ba1`.
2. Once enabled, open the app on bitovi-training (staging) and force an error. The devtools console
   is enough: `console.error('frontend-logs smoke test')`. Check it appears under **Logs** in the
   developer console.
3. Note in this file what the logs look like. In particular, check whether they show which site and
   which module (`main` / `project`) the error came from. Without that, a production log is hard to
   act on.

### A2. Fallback if the EAP isn't available: relay through the resolver

If the EAP is refused or too limited, the frontend can send errors to the existing `storage-resolver`
function. It logs them with `console.error`, and they show up under the developer console's **Logs**
or in `forge logs -e production`.

- Add one resolver function, e.g. `log.error`, next to `storage.get` / `storage.set` in
  `src/forge-resolver/contract.ts`. The comment at the top of `src/forge-resolver/index.ts` says not
  to let that file grow without a reason; error reporting is a reason, but keep it to one function.
- On the Forge host only, have `window` `error`, `unhandledrejection` and the `ErrorBoundary`
  `onError` callbacks `invoke('log.error', { name, message, stack, module })`. Rate-limit it on the
  client side (e.g. at most N per minute per page), so an error loop can't burn through the
  invocation quota.
- No manifest change and no new scope: the function module already exists. **Minor version.**
- Cost: one function invocation per reported error.

### What to keep out of logs (applies to A1 and A2)

The logs stay inside Atlassian, but we still see them, and the
[shared responsibility model](https://developer.atlassian.com/platform/forge/shared-responsibility-model/)
puts what we log on us. Don't `console.error` JQL, issue summaries or descriptions, or user names.
Log ids and error types instead. That rule applies to the existing `console.error` calls too: when
the EAP is enabled, grep for `console.error(` and check what each one passes.

### Limits of Option A

- No grouping, deduplication, release tracking or alerts. Someone has to look at the logs.
- 30-day retention.
- Site admins can turn off log sharing for their site
  ([access app logs](https://developer.atlassian.com/platform/forge/access-app-logs/)). It's on by
  default for standard cloud. Isolated Cloud customers' logs are never visible to us.
- The EAP is pre-release, so its behaviour and availability may change.

## Option B: Sentry as analytics egress

Only if Option A turns out not to be enough.

### What makes it allowed

- Sentry is on Atlassian's pre-approved analytics list
  ([analytics tool policy](https://developer.atlassian.com/platform/forge/analytics-tool-policy/)):
  `*.ingest.sentry.io`, `*.ingest.us.sentry.io`, `*.sentry-cdn.com`. Tools that aren't on the list
  get their deploys blocked.
- Runs on Atlassian allows analytics egress that carries **no in-scope end-user data**, provided
  customers can turn it off. They can: admins enable or disable analytics egress per app at
  admin.atlassian.com.

### What would have to change

1. **Manifest:** declare the egress, under the analytics category, with no end-user data.

   ```yaml
   permissions:
     external:
       fetch:
         client:
           - address: '*.ingest.us.sentry.io' # match the region in the DSN
             category: analytics
             inScopeEUD: false
   ```

   `fetch.client` is the right place, because it's what Forge adds to the iframe's `connect-src`.
   Leaving out `inScopeEUD: false` defaults it to `true`, which **loses Runs on Atlassian**.

2. **A separate initialiser for Forge**, e.g. `initForgeSentry` in `src/shared/sentry.js`. **Don't**
   reuse `initSentry`: the website's config has to stay as it is, and if Forge shared it, the next
   person to add an integration for the website would silently break the Forge promise. It needs:

   - **no tracing:** no `browserTracingIntegration`, `tracesSampleRate: 0`;
   - **no feedback:** no `feedbackIntegration`. The feedback forms stay replaced by a link
     ([above](#a-live-bug-the-feedback-forms-send-nothing-on-forge)), because they collect end-user
     data;
   - **no session replay** (not used today; never add it on Forge);
   - **no breadcrumbs:** `maxBreadcrumbs: 0`, or a `beforeBreadcrumb` that returns `null`;
   - `sendDefaultPii: false`, and never call `Sentry.setUser`;
   - **a `beforeSend` that cleans every event:**
     - `request.url` reduced to origin + path, with no query string and no hash;
     - `request.query_string`, `request.headers`, `request.cookies`, `user`, `extra` and anything in
       `contexts` that isn't runtime, browser or OS removed;
     - exception **messages** replaced by the error type, unless they match a short allow-list of
       messages we know are safe (our own `[Storage Error]: …` strings, for example);
     - stack frame `vars` removed.
   - `environment: 'forge-production'` / `'forge-staging'`, and ideally a **separate Sentry
     project**, so Forge events are never mixed in with website events that are allowed to carry
     more.

3. **The DSN, hardcoded in `forge.main.ts`:** replace `''` with the Forge project's DSN as a
   literal. DSNs are public by design, and a literal keeps the property described above: nothing in
   `.env` can change what the Forge bundle sends. Also, `vite.forge.config.ts` sets `root: 'forge'`,
   so Vite never reads the repo `.env` for this build anyway.

4. **Tests that enforce the promise:** a unit test that feeds `beforeSend` an event containing JQL
   in the URL, an issue key in the message and a `user`, and checks that what comes out contains
   none of them. A second test checks `initForgeSentry`'s options have no tracing, no feedback and
   no breadcrumbs. Those tests are the only thing stopping a later "small tweak" from reintroducing
   end-user data.

5. **Release:**

   - expect a **major version**, with admin consent on every site. Bundle it with another release
     that already needs one; don't ship it on its own;
   - check that the deploy output still says the app "is eligible for the Runs on Atlassian
     program";
   - update the Marketplace **Privacy & Security** answers. "Makes no requests outside Atlassian"
     stops being true, and the analytics egress has to be described.

6. **Expect partial coverage:** sites that turn off analytics egress send nothing, and that's by
   design.

### The ongoing cost

`inScopeEUD: false` is a promise Bitovi makes to Atlassian and to customers. Every future change to
the Forge Sentry config, and every new error message, has to keep that promise. The tests in step 4
make it enforceable, but it's still an ongoing commitment, not a one-off task.

## Comparison

|                          | Today    | A1: frontend-logs EAP     | A2: resolver relay | B: Sentry analytics                              |
| ------------------------ | -------- | ------------------------- | ------------------ | ------------------------------------------------ |
| Errors visible to us     | None     | Yes                       | Yes                | Yes                                              |
| Code change              | —        | None                      | Small              | Medium + tests                                   |
| Manifest change          | —        | None                      | None               | `external.fetch.client`                          |
| Version                  | —        | —                         | Minor              | **Major** (probably)                             |
| Runs on Atlassian        | Eligible | Eligible                  | Eligible           | Eligible only with `inScopeEUD: false` kept true |
| Grouping and alerts      | —        | No                        | No                 | Yes                                              |
| Retention                | —        | 30 days                   | 30 days            | Sentry plan                                      |
| Customer can turn it off | —        | Log sharing               | Log sharing        | Analytics egress                                 |
| Depends on               | —        | Being admitted to the EAP | Nothing            | Ongoing data discipline                          |

## Order of work

1. **Feedback forms:** replace them with a link on Forge. Minor version. Do it now; it's a live bug.
2. **A1:** sign up for the frontend-logs EAP, then check it on staging.
3. **A2:** only if A1 is unavailable or not enough.
4. **B:** only if we need Sentry-style grouping and alerts, and only with a release that is already
   a major version.

Steps 2–4 come after the fully-Forge work and the CI/CD plan ([ci-cd.md](../next-steps/ci-cd.md)),
in line with shipping the Forge release before nice-to-haves.

## Open questions

- Where should Forge customers send feedback (the link in step 1)?
- Does the EAP show the **site** an error came from? If not, A2 can include it explicitly.
- Does adding analytics egress really produce a major version? The answer only matters for B.
  The deploy output will say; check before approving.

## Sources

- [Runs on Atlassian](https://developer.atlassian.com/platform/forge/runs-on-atlassian/): egress rules, analytics exception
- [Analytics tool policy for Forge apps](https://developer.atlassian.com/platform/forge/analytics-tool-policy/): Sentry on the approved list
- [Manifest: permissions](https://developer.atlassian.com/platform/forge/manifest-reference/permissions/): `external.fetch.client`, `category`, `inScopeEUD`
- [Runtime egress permissions](https://developer.atlassian.com/platform/forge/runtime-egress-permissions/)
- [View app logs](https://developer.atlassian.com/platform/forge/view-app-logs/): frontend-logs EAP, 30-day retention
- [Debugging: frontend log limits](https://developer.atlassian.com/platform/forge/debugging/#frontend-log-limits)
- [Access app logs](https://developer.atlassian.com/platform/forge/access-app-logs/): customer log-sharing controls
- [Forge CLI: logs](https://developer.atlassian.com/platform/forge/cli-reference/logs/)
- [Shared responsibility model](https://developer.atlassian.com/platform/forge/shared-responsibility-model/)
- [Community: monitoring Forge apps with Sentry](https://community.developer.atlassian.com/t/is-there-any-solution-to-monitor-forge-apps-with-sentry/88072)
