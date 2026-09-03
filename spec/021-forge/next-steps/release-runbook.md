# Release runbook — the fully-Forge version

Written 2 Sep 2026. Companion to [status-2026-09-02.md](./status-2026-09-02.md) (what is built and
why) and [ci-cd.md](./ci-cd.md) (how this becomes automated later). This is the by-hand sequence for
the first fully-Forge release.

Every command runs from the repo root after `nvm use`. **Node ≥ 22.12 is mandatory** — the Forge CLI
`require()`s ESM-only `archiver` and fails with `ERR_REQUIRE_ESM` on older Node.

Two standing rules for the whole runbook:

- **If any command offers to delete the Connect key `bitovi.status-report`, answer `N`.** That key is
  what grants access to existing customers' saved reports.
- **`forge deploy` with no `-e` deploys to PRODUCTION.** Always state the environment.

`--approve MAJOR_VERSION_RULE` is a local CLI acknowledgement, not a Marketplace submission. It
appears because `forge lint` flags _"Change due to migration key modification"_.

---

## Step 0 — Preflight

```bash
cd /Users/arthur/workspace/bitovi/jira-timeline-report
nvm use
node -v          # must print v22.23.2 (or ≥ 22.12)
git status       # expect branch feature/forge
npx forge lint   # expect: 0 errors, 0 warnings, 1 approval (MAJOR_VERSION_RULE)
```

**Before going further, confirm you have partner admin on `marketplace.atlassian.com/manage`.**
[plan.md](./plan.md) still lists this as an open question. Without it you cannot see the version you
are about to create, or talk to the reviewer about it.

---

## Step 1 — Deploy to `prodcheck`

Touches only the `prodcheck` environment and `arthurpankiewicz.atlassian.net`. **Nothing reaches
Marketplace or any customer.**

```bash
npx forge deploy -e prodcheck --approve MAJOR_VERSION_RULE
npx forge install --upgrade -e prodcheck
```

**Expect:** deploy succeeds; install reports the site upgraded. A prompt about scopes changing is
normal and must be approved — the manifest declares all four scopes (Step 3). Hard-refresh the app
afterwards: a scope grant does not apply to an already-loaded iframe.

**Check in if:** anything mentions deleting a Connect key, the deploy errors, or the install cannot
find the existing installation.

---

## Step 2 — Verify on `arthurpankiewicz.atlassian.net`

This is the real test. (It used to double as a scope experiment; that is now settled — see Step 3.)

| #   | Check                                                                       | Pass looks like                           | Fail means                                                                          |
| --- | --------------------------------------------------------------------------- | ----------------------------------------- | ----------------------------------------------------------------------------------- |
| 1   | Apps menu → **Status Reports for Jira**                                     | Exactly **one** entry, opens the app      | Two entries → the old `status-reports-global` module key did not get replaced       |
| 2   | A report loads real issues                                                  | Issues render from a JQL query            | **403 / empty** → scopes insufficient, go to Step 3                                 |
| 3   | Settings sidebar → field list                                               | Real Jira field names listed              | **Empty** → scopes insufficient                                                     |
| 4   | Saved reports                                                               | `save`, `save2`, `save3` listed           | Missing → the storage adapter is not reaching Connect app properties                |
| 5   | Save a new report, hard refresh                                             | It persists                               | Write path broken                                                                   |
| 6   | Settings → Storage panel                                                    | **In Jira** card live, Key/Value selected | Pointer mismatch                                                                    |
| 7   | Open any project → project nav                                              | App appears and opens                     | The `project` module key is wrong                                                   |
| 8   | Browser console                                                             | No CSP violations                         | `content.styles` needs revisiting — note that changing it is itself a major version |
| 9   | **URL state** — configure a report, copy the browser URL, open in a new tab | Same report comes back                    | Inbound deep links do not survive; see below                                        |

**Result, 2 Sep: all nine passed** on `arthurpankiewicz.atlassian.net` with the four-scope manifest.
Console showed some errors judged to be Jira's own noise rather than the app's — worth a second look
if anything misbehaves later, but nothing broken was observed.

Check 9 was the one genuinely new piece of information, and it passed: **Forge deep links already
work**, so the app's own URL is a shareable report link. That is what `deeplink` existed for, which
is why dropping it costs nothing. See
[status-2026-09-02.md](./status-2026-09-02.md#forge-url-persistence-replaces-acsubstitution).

---

## Step 3 — SETTLED: all four scopes are required ✅

**Do not try to trim the scope list again.** Tested on prodcheck 2 Sep: deployed with only
`read:connect-jira` / `write:connect-jira` (the two production v2 declares), the app installed and
rendered but could not talk to Jira —

- reading a Reports Space failed with _"Could not read \"REPTEST\". Check the space key and that you
  have access to it."_, from `react/services/reports-storage/useSpaceIssueTypes.ts:62` wrapping
  `fetchProjectIssueTypes`, an ordinary Jira project read
- saved reports did not load

Adding `read:jira-work` / `write:jira-work` back fixed both, confirmed on prodcheck. The legacy
Connect compatibility scopes cover the **Connect** endpoints (app properties), not the **Jira REST
API** that `requestJira` calls. Atlassian's
[scope equivalences page](https://developer.atlassian.com/platform/adopting-forge-from-connect/connect-to-oauth2-scope-equivalences/)
does not state this either way.

**Consequence for the release:** the declared scope set genuinely increases against production v2, so
customers will see a permission prompt on upgrade — already accepted
([status-2026-09-02.md](./status-2026-09-02.md#decisions-settled)) — and the Marketplace version will
most likely land as `3.0.0` rather than `2.2.0`.

The required set, all four:

```yaml
permissions:
  scopes:
    - read:jira-work # Jira REST via requestJira — REQUIRED, see above
    - write:jira-work # ditto
    - read:connect-jira # Connect app properties — existing customers' saved reports
    - write:connect-jira
```

---

## Step 4 — Read the production Connect keys

Needs a TTY, so it cannot be run for you.

```bash
npx forge version details -e production
```

**Look for `Connect keys`.** Production reports **2**; the new manifest declares **1**. That
mismatch is what `forge lint` calls _"migration key modification"_, and it — not the scopes — is what
forces the major version locally. If the second key is something the new manifest can legitimately
keep declaring, matching it may remove the trigger entirely, which is a better outcome than the scope
trim.

**Check in with:** what the two keys are. This is worth pausing on before Step 6.

---

## Step 5 — Commit

```bash
git add -A
git commit
```

Everything so far is reversible. From Step 6 it is not.

---

## Step 6 — Deploy to `production` ⚠️ point of no return

> **Read the whole step before running it.** "Point of no return" is literal in a way that is easy to
> underestimate: Marketplace detects a production deploy within minutes and files it as a version
> awaiting approval, and **the partner console cannot withdraw a pending version.** Only Atlassian
> can reject one. There is no undo, and no "deploy again quickly enough" — deploying the fix creates
> a _second_ pending version and leaves the bad one in the queue.
>
> This is exactly what happened on 3 Sep: major version 3 went out with licensing disabled, 4 fixed
> it five minutes later, and the console ended up holding **both** 3.0.0 (Free) and 4.0.0 (Paid) as
> pending, with support the only route to removing 3.0.0. **Check `manifest.yml` against the expected
> table below _before_ deploying, not after.**

This removes the Connect modules from the production environment and causes Marketplace to create a
new version within minutes.

**Safe because:** confirmed 2 Sep that no customer is on the Forge `production` environment.
Customers are on the Connect version `1.2.0-AC`; 2.0.0 and 2.1.0 are pending and never released;
`forge install list` shows only `bitovi-training` (development) and `arthurpankiewicz` (prodcheck).

```bash
npx forge deploy -e production --approve MAJOR_VERSION_RULE
```

**Expect:** success, and the app's Forge major version goes 2 → 3. Answer `N` to any Connect key
deletion prompt.

```bash
npx forge version list -e production
```

**Check every column of the new row, not just that it appeared.** Expected:

| Column         | Expected                                    | Why it matters                                                   |
| -------------- | ------------------------------------------- | ---------------------------------------------------------------- |
| `Egress`       | empty                                       | any value means an egress permission customers see at install    |
| `Policies`     | `styles: 1`                                 | the Atlaskit `unsafe-inline`                                     |
| `Scopes`       | `4`                                         | all four are required (Step 3)                                   |
| `Connect keys` | `2`                                         | the key survived — this is what reaches customers' saved reports |
| `Remotes`      | `0`                                         | a remote disqualifies Runs on Atlassian                          |
| `Modules`      | `jira:globalPage: 1`, `jira:projectPage: 1` | native Forge, no `connect-jira:*`                                |
| **`License`**  | **`true`**                                  | **`false` means the app ships unlicensed — see below**           |

The deploy output should also end with _"is eligible for the Runs on Atlassian program"_.

⚠️ **`License: false` bit us on 3 Sep.** Major version 3 deployed with licensing off because
`manifest.yml` had no `app.licensing` block, and nothing failed — `forge lint` passed, the deploy
succeeded, it even reported Runs on Atlassian eligibility. `getLicensing()`
(`src/forge.main.ts:28`) treats an absent license as allowed, so every install would have run
unlicensed. v4 fixed it five minutes later.

**Marketplace noticed inside those five minutes.** Atlassian Marketplace Support replied on the
approval thread: _"The newly submitted version for this app has its payment model set to Free, the
previous version was Paid via Atlassian. Can you confirm if this was your intention?"_ So the
consequence is not hypothetical — a bad deploy reaches Marketplace within minutes and lands in the
review queue as a Free version. Answer that the omission was unintentional and point the reviewer at
the corrected version.

This column is the only place the mistake is visible from the CLI.

---

## Step 7 — Marketplace

**No console step creates the version.** Atlassian detects the production deploy and publishes
automatically:

> "We automatically detect updates to Forge apps when any changes are released to the production
> environment... When a change is detected, we automatically update your app in the Atlassian
> Marketplace with a new version."
> — [Upgrade and version cloud apps](https://developer.atlassian.com/platform/marketplace/upgrading-and-versioning-cloud-apps/)

What to do at `marketplace.atlassian.com/manage`:

1. **Wait a few minutes, then confirm the version appeared.** Note its number — this is how you learn
   how Atlassian classified the change. `3.0.0` means it read the change as a scope increase;
   `2.2.0` means it treated the scopes as inherited and this is a minor update, which is the better
   outcome for rollout speed.
2. **Message the reviewer on the existing 2.0.0 / 2.1.0 thread.** Say this new version is the one
   customers should land on, so they skip Connect-on-Forge entirely.
3. **Ask the ordering question:** what happens if 2.0.0 / 2.1.0 are approved _after_ the fully-Forge
   version. Marketplace normally serves the highest version, so it should be inert — but a
   Connect-on-Forge app landing on top of a fully-Forge one is worth ruling out rather than
   discovering.
4. **Ask the two standing questions** while you have their attention:
   - Are Connect app properties supported past Connect end of support (Dec 2026)? The answer sets the
     deadline for moving to Forge KVS — see
     [status-2026-09-02.md](./status-2026-09-02.md#after-the-transition-move-new-installs-to-forge-kvs).
   - Does this release count as adding _inherited_ scopes or _additional Forge-specific_ scopes?

**Check in with:** the version number that appeared. It answers the classification question that has
been open all along.

---

## Step 8 — After approval

- `forge version bulk-upgrade` — Atlassian's table lists this as required when the Connect remote is
  removed, independent of admin approval. Confirm it is needed before running it.
- **Release notes** — still unwritten; listed as outstanding in
  [status-2026-09-02.md](./status-2026-09-02.md).
- **Security questionnaire** — the answers attached to the pending versions are wrong for this
  release in both directions. See
  [status-2026-09-02.md](./status-2026-09-02.md#also-worth-fixing-unrelated-to-the-code). The
  "doesn't make requests outside of Jira" answer is now _true_ for the fully-Forge build, which it
  was not for v2.
- **Delete the sandbox app** (`916b1dfd-…`) and its Developer Space — [plan.md](./plan.md) Step 1.
