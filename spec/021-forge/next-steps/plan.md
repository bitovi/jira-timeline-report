# Getting Forge to real users — the human checklist

> **Audience: people, not AI.** Everything here needs an Atlassian login, a browser, a credential, or
> a decision. The coding work is tracked in [spec/021/plan.md](../plan.md); this is the other half.
>
> Written 14 Aug 2026.

## Where we are today

There is a working Forge app installed on one Jira site. It renders real reports, reads and writes
real data, links out to work items, and survives a refresh.

It is also **a throwaway**. It was registered as a brand-new app in a personal Developer Space
(`arthur-forge-sandbox`), it is called "Status Reports for Jira (forge - arthur)", and it has no
relationship to the Marketplace listing. Nothing in it is wasted — all the _code_ transfers — but the
app itself is not the thing that ships.

## The one decision that gates everything

**Do we convert the existing Marketplace app, or list a new one?**

|                          | Convert the existing app<br>("incremental adoption") | List a new app<br>("successor app")            |
| ------------------------ | ---------------------------------------------------- | ---------------------------------------------- |
| Customers do             | **Nothing** — it updates like any version            | Find and install a new app, migrate their data |
| Reviews & install count  | Kept                                                 | Start from zero                                |
| Licences / subscriptions | Continue                                             | Re-established                                 |
| Existing saved reports   | Migration path stays open                            | Orphaned                                       |
| App key                  | Unchanged                                            | New                                            |

**Recommendation: convert the existing app.** The middle three rows are the business case; the first
row is the one customers will feel.

Nothing else on this page can be sequenced until this is settled, so it is the first agenda item for
the team conversation.

---

## Before that conversation — three things to find out

### 1. Has the Marketplace listing shipped an update since March 2026? — _Arthur / whoever releases_

Connect "Phase 2" enforcement (March 2026) stopped Marketplace apps with a Connect descriptor from
publishing new **versions**. It did **not** stop us shipping code — our iframe loads from
`statusreports.bitovi.com`, so pushing to S3 still reaches users immediately and always will.

So the question is narrower than it sounds: **have we needed to publish a Marketplace version, and
could we?** If we have not tried since March, we do not actually know whether we are blocked.

Either way, what is frozen today is the descriptor: `scopes: ["read","write"]`, the three modules
(`main`, `deeplink`, `project`), and the `deeplink` URL's hardcoded parameter list. We cannot change
any of those until a Forge manifest is adopted.

### 2. Who has Marketplace partner admin for Bitovi? — _whoever knows_

Submitting a version, editing the listing, and reading install data all need partner-level access to
<https://marketplace.atlassian.com/manage>. If that is one person who is not in this conversation,
find out now rather than at submission time.

### 3. Can a Forge app read Connect app properties? — _engineering, ~1 hour_

This is a technical question with a big product consequence, so it belongs on the list.

Connect stores every customer's saved reports and settings in an app property. If a Forge module can
read those, cutover is seamless. If it cannot, customers arrive at an empty app and have to set
storage up by hand.

It also decides whether we add a backend at all — see
[resolver-storage/plan.md](../resolver-storage/plan.md), which is blocked on this answer.

---

## The path, assuming we convert the existing app

### Step 1 — Sort out identity and access — _human, ~1 hour_

- [ ] Create or find a **Bitovi** Developer Space (not a personal one). `forge developer-spaces` lists
      what exists.
- [ ] Add the teammates who will work on this as contributors, so `forge deploy` is not
      bottlenecked on one person.
- [ ] Delete the `arthur-forge-sandbox` space and its app once its work is folded in. A space can be
      deleted only when no apps are assigned to it.

### Step 2 — Phase A: put a Forge manifest on the existing app — _AI writes, human deploys_

This is the step that un-freezes the descriptor. The existing Connect modules get declared inside a
Forge manifest (`connectModules`, plus `core:connectToForgeMigration`), keeping the app key.

**Nothing changes for users.** Same iframe, same S3 URL, same code. It is a no-op release whose only
purpose is to make future releases possible.

- [ ] Confirm the generated manifest matches the live descriptor exactly before deploying.
- [ ] Deploy to `staging`, install on a test site, confirm the app renders unchanged.
- [ ] Promote to `production` and publish a Marketplace version.

Human parts: the `forge deploy` runs, the test-site verification, and the Marketplace submission.

### Step 3 — Convert modules one at a time — _AI writes, human verifies_

The descriptor has three: `main`, `deeplink`, `project`. Each is independently either Connect or
Forge — there is no half-converted state, so nothing is ever broken mid-flight.

The thing to watch is **disagreement**, not breakage: while `main` is on Forge and `deeplink` is
still on Connect, the two entry points can read saved reports from different places. That argues for
converting all three close together, or settling storage first.

- [ ] Decide storage before starting (see question 3 above).
- [ ] Convert, deploy to staging, verify on a test site, promote.
- [ ] Repeat. When the last Connect module is gone, it is a Forge app.

### Step 4 — Get Forge into CI — _AI writes, human supplies secrets_

Until this is done, **Forge is deployed by hand and drifts.** Staging S3 deploys on every push to
`main`, so between manual `forge deploy`s the Forge app is running older code than the website.
Expect at least one "it reproduces on staging but not on Forge" hunt; check the deployed Forge
version before chasing it.

The design is in [spec/021 Phase 7](../plan.md#phase-7--ci-in-two-stages): **not** a separate
`deploy-forge.yaml`, but a Forge job added to each existing workflow, so one trigger ships all three
hosts and they cannot drift.

| Workflow              | Trigger                  | Added job                                            |
| --------------------- | ------------------------ | ---------------------------------------------------- |
| `deploy-staging.yaml` | push to `main`           | `npm run build:forge` → `forge deploy -e staging`    |
| `deploy-prod.yaml`    | GitHub release published | `npm run build:forge` → `forge deploy -e production` |

**Move to this once** every row of the spec/021 verification table passes on a real site, two or
three manual deploys have gone out uneventfully, and the scope list has settled. Automating a path
that has not been proven by hand just moves the debugging into GitHub Actions, where the feedback
loop is minutes instead of seconds.

Human actions:

- [ ] Add `FORGE_EMAIL` and `FORGE_API_TOKEN` as repository secrets. The CLI reads both from the
      environment, so no `forge login` step is needed in the workflow.
- [ ] **Decide whose account CI acts as.** A personal API token ties every deploy to one person —
      it breaks when they rotate the token or leave. A shared/service Atlassian account is better,
      and it must be a contributor on the app (a member of the Developer Space), or `forge deploy`
      will not be authorised.
- [ ] Make the call on the promotion gate above — that one is judgement, not a command.

Three constraints the workflow must respect (AI's job, but worth knowing why if a build goes red):

1. **The Forge job must never gate the others.** No existing job takes `needs:` from it. A Forge
   failure should be loud but must not block the S3 or EC2 deploys — those serve the two hosts
   already in production.
2. **Pin the CLI major version.** An unpinned `npm i -g @forge/cli` means an unrelated CLI release
   can break the pipeline on a random day.
3. **Permission changes are _supposed_ to fail the build.** `forge deploy` refuses a major version
   without `--approve MAJOR_VERSION_RULE`, and that flag must **not** be added to CI — a scope change
   should stop the pipeline and get a human's attention, because an admin has to approve the upgrade
   on every install before it takes effect anyway.

### Step 5 — Marketplace release — _human_

- [ ] Publish the version from <https://marketplace.atlassian.com/manage>.
- [ ] Expect privacy and security declarations to need review — data storage location and what the
      app collects. Worth reading the current requirements early rather than at submission; they
      change.
- [ ] Run `forge eligibility` to see whether the app qualifies for **Runs on Atlassian**, which is a
      trust badge on the listing and worth having if it is within reach.
- [ ] Update listing screenshots if the UI changed.

### Step 6 — After release — _human_

- [ ] Watch for the "empty app" support ticket. A site whose reports live in a Reports Space will
      open Forge in `legacy` mode, because that pointer is stored per-host and does not cross from
      Connect. It is not data loss — an admin re-points it in the Storage panel — but it will be
      reported as a bug. Get it into the release notes first.
- [ ] Decide when to retire `plugin.main.ts` and the Connect host from the repo.

---

## Things not to do

- **Do not `forge deploy -e production` the sandbox app.** That is what makes its app key permanent.
  While it stays on `development`, the whole thing is disposable.
- **Do not add `licensing` to the sandbox manifest.** A licensed or Marketplace-submitted app cannot
  be shared via installation link, which is the cheap way to let a teammate try it.
- **Do not add scopes casually once there are real installs.** Every scope addition is a major
  version that each site admin must approve, and installs stay on the old permissions until they do.
  Settle the scope list while the install count is one.

## If we only want teammates to try it, not customers

Marketplace is not required for that. Deploy to `production`, then in the developer console:
Distribution → Distribution controls → Edit → **Sharing** → Save. That generates an installation link
anyone can use, provided they are an admin of their own site. No Atlassian review.

Caveat: generating a new link invalidates the old one, and this option disappears once the app is
licensed or submitted for listing.

## Timeline

Connect end of support is **Q4 2026** — roughly four months out. That does not switch our app off;
Connect modules keep running "at your own risk," without patches or platform guarantees. What it
means practically is that we stop having a supported platform under the embedded app, and any
Atlassian-side breakage becomes our problem with no recourse.

Phase A (Step 2) is what decouples us from that date, and it is cheap. Worth doing regardless of how
long Step 3 takes.

## Useful commands

Run from the repo root; `npx` because the CLI is a local dependency, not global.

| Command                       | What it tells you                                   |
| ----------------------------- | --------------------------------------------------- |
| `npx forge whoami`            | which Atlassian account the CLI is acting as        |
| `npx forge install list`      | every site this app is installed on                 |
| `npx forge environments list` | development / staging / production state            |
| `npx forge developer-spaces`  | which spaces exist and which one an app is in       |
| `npx forge eligibility`       | Runs on Atlassian and similar programme eligibility |
| `npx forge logs`              | app logs (only meaningful once there is a function) |

## References

- [spec/021/plan.md](../plan.md) — the engineering plan and its verification table
- [spec/021/platform-constraints.md](../platform-constraints.md) — the Connect timeline, with sources
- [resolver-storage/plan.md](../resolver-storage/plan.md) — the storage decision, blocked on question 3
- [Adopting Forge from Connect](https://developer.atlassian.com/platform/adopting-forge-from-connect/)
- [Distribute your apps](https://developer.atlassian.com/platform/forge/distribute-your-apps/)
