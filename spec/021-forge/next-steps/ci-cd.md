# CI/CD for the fully-Forge app

> Supersedes [plan.md § Phase 7](../plan.md) where they conflict. Phase 7 was written while Forge was
> a _third_ host alongside the website and Connect, and its central instruction — "the Forge job must
> not gate the others" — is exactly backwards once Forge is the host customers use.
>
> Read [status-2026-09-02.md](./status-2026-09-02.md) first for where the conversion stands.

## What inverts at the cutover

Today the Marketplace app is Connect-on-Forge: the manifest wraps the Connect descriptor, and the
iframe loads from `statusreports.bitovi.com`. So **a push to S3 reaches every customer immediately**,
and `deploy-prod.yaml` already does that. [plan.md:48](./plan.md) states this as a permanent
property — "pushing to S3 still reaches users immediately and always will". That stops being true.

|                              | Connect-on-Forge (today)                   | Fully Forge                             |
| ---------------------------- | ------------------------------------------ | --------------------------------------- |
| Who serves the app UI        | S3/CloudFront → `statusreports.bitovi.com` | Atlassian's CDN (`*.atlassian-dev.net`) |
| Manifest `Remotes`           | 1                                          | 0                                       |
| How a fix reaches customers  | `Deploy-Static-Assets` job → CloudFront    | `forge deploy -e production`            |
| Blast radius of a CI failure | The website and Connect                    | **Every customer**                      |
| Who is still served by S3    | website + Connect + OAuth server           | website + OAuth server only             |

The S3/CloudFront and EC2 paths do **not** go away — they still serve the standalone website at
`statusreports.bitovi.com` and the express OAuth server. They just stop being how Jira customers get
the app.

**So the Phase 7 Stage 2 constraint reverses.** A failed Forge deploy is no longer a background
annoyance that must not block the real deploys; it _is_ the real deploy. Treat a Forge job failure in
`deploy-prod.yaml` as a release failure.

## How a change actually reaches a customer

Two independent gates, and it is worth keeping them apart because they fail differently.

**1. Forge app version.** `forge deploy` decides minor vs major on its own:

> "Minor versions are incremental improvements to major versions. Forge automatically updates all
> installed apps to the latest minor version of their major version (without requiring admin
> consent)." … "By default, a new major version won't be applied to a site until its admin consents
> to the upgrade."
> — [App versions](https://developer.atlassian.com/platform/forge/versions/)

A major version is triggered by: adding or changing OAuth scopes or app permissions, changing CSP
options, adding or changing web triggers, enabling licensing, and adding or removing providers. Note
that `content.styles: [unsafe-inline]` is a CSP option — changing it is a major version, not a
detail.

Everything else — a bug fix, a UI change, adding or removing a Forge module — is minor and lands on
every install with no admin action. That is the answer to "can we still hotfix": yes, for anything
that doesn't touch the manifest's permissions.

**2. Marketplace distribution.** New Marketplace versions publish within a few minutes of a
production release via the CLI, so there is no separate submit-and-wait step for ordinary changes.

### The wrinkle specific to this release

Atlassian classifies Connect→Forge changes on their own table, and it does **not** line up with the
CLI's major/minor call. From
[Minor version updates (Connect to Forge)](https://developer.atlassian.com/platform/adopting-forge-from-connect/connect-forge-updates/):

| Change                                                              | Admin approval? | Needs bulk-upgrade? |
| ------------------------------------------------------------------- | --------------- | ------------------- |
| Add/modify/remove **Forge** modules                                 | No              | No                  |
| **Remove the Connect remote**                                       | No              | **Yes**             |
| Add **inherited** OAuth 2.0 scopes                                  | No              | **Yes**             |
| Add additional **Forge-specific** OAuth scopes (subsequent updates) | **Yes**         | —                   |
| Add new scopes that elevate access                                  | **Yes**         | —                   |
| Modify CSP / fetch permissions                                      | No              | No                  |

This release removes the Connect remote and adds `read:jira-work` / `write:jira-work` on top of
`read:connect-jira` / `write:connect-jira`. Whether those two count as **inherited** (from Connect's
coarse `read` / `write`, so no admin approval but a bulk-upgrade) or as **additional Forge-specific
scopes** (admin approval, per site) is the difference between a rollout we control and one that waits
on thousands of admins.

**Decided 2 Sep: admin approval is acceptable.** So this no longer gates the release — plan for the
per-site prompt and be pleasantly surprised if Atlassian classifies the scopes as inherited. It is
still worth asking on the Marketplace review thread, alongside the Connect-app-properties
deprecation question [status-2026-09-02.md](./status-2026-09-02.md#after-the-transition-move-new-installs-to-forge-kvs)
already lists, because the answer sets how fast the rollout actually moves.

Note the CLI has already required `--approve MAJOR_VERSION_RULE` for the prodcheck deploys, so
locally it reads as major. That does not settle the distribution question — the two systems classify
independently.

Either way, `forge version bulk-upgrade` is part of this release's runbook, because removing the
Connect remote requires it regardless.

## What blocks Forge CI today (one down, two left)

1. ~~**The root `manifest.yml` points at the sandbox app.**~~ **Done 2 Sep.** The repo's
   `manifest.yml` is now the Marketplace app (`12573c92-9009-45d3-ab51-46f65ffa1ba1`) with
   `app.connect.key: bitovi.status-report`, module keys `main` / `project`, no `connectModules` and
   no `remotes`. `forge lint` passes with 0 errors and one expected `MAJOR_VERSION_RULE` approval.
   Deploys no longer need the scratch directory — run them from the repo root.
2. **Node ≥ 22.12.** Both workflows pin `node-version: 22`, which resolves to the newest 22.x and is
   fine today, but the requirement is sharp (the CLI `require()`s ESM-only `archiver`). Switch to
   `node-version-file: .nvmrc` so the pin is stated once, in the file that already says `v22.23.2`.
3. **`FORGE_EMAIL` and `FORGE_API_TOKEN` as repository secrets.** 👤 Human step. The CLI picks them
   up automatically, so no `forge login` in the pipeline.

## The workflow changes

Still not a separate `deploy-forge.yaml` — one trigger should ship every host, or they drift.

| Workflow              | Trigger                  | Added job                                                                                                  |
| --------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------- |
| `deploy-staging.yaml` | push to `main`           | `npm run build:forge` → `forge deploy -e staging` → `forge install --upgrade -e staging --non-interactive` |
| `deploy-prod.yaml`    | GitHub release published | `npm run build:forge` → `forge deploy -e production`                                                       |

Six constraints, each of which has a specific way of biting:

1. ~~**The Sentry DSN trap.**~~ **Closed in code, 2 Sep.** `forge.main.ts` now passes
   `FRONTEND_SENTRY_DSN: ''` as a literal instead of reading
   `import.meta.env.VITE_FRONTEND_SENTRY_DSN`, so no `.env` — including the one
   `generate-build-env.sh` writes and Vite loads automatically — can reach the Forge bundle. The
   trap was real: a live DSN means egress, an `egress` permission customers see at install, and the
   loss of Runs on Atlassian eligibility, and with `tracesSampleRate: 1.0` and JQL in the URL it
   would have meant customer JQL leaving Jira. Nothing needs setting on the CI build step now, but
   do not undo the literal.
2. **`VITE_JIRA_APP_KEY=bitovi.status-report`**, always — the storage adapter reads that addon's
   Connect properties, and the wrong key silently reads an empty store. `deploy-prod.yaml` already
   sets it; `deploy-staging.yaml` sets `bitovi.status-report.staging`, which is correct for the
   Connect staging descriptor but **wrong for a Forge staging deploy of the Marketplace app**. The
   Forge step needs its own value, not the workflow's.
3. **Never `--approve MAJOR_VERSION_RULE` in CI.** A scope or CSP change should stop the pipeline and
   get a human's attention, because the rollout consequences (above) need a decision, not a flag.
4. **`-e production` is the default environment.** A `forge deploy` with no `-e` in a workflow file,
   or a copy-paste from the staging job, deploys to production. Always state the environment
   explicitly, in every job, including staging.
5. **Pin the CLI major version** — `npm i -g @forge/cli@<major>`. An unpinned global install lets a
   CLI release break the pipeline on an unrelated day.
6. **Separate build artifact.** The Forge build outputs `dist-forge/`, not `./dist`, so it needs its
   own build step and its own `upload-artifact` rather than reusing the shared `build` artifact.

## What happens to the Connect descriptor

`npm run create:atlassian-connect` and the `connect.html` rollup input stay — they serve the local
Connect development loop and the staging Connect app. What changes is that the generated
`public/atlassian-connect.json` on `statusreports.bitovi.com` **stops being what Marketplace
customers install.** Once the Marketplace app has no `connectModules`, that descriptor is a
development artifact. Do not delete it in this release; do stop treating a change to it as
customer-facing.

## Sequencing

Keep [plan.md § Phase 7](../plan.md)'s two-stage shape — it is still right, only the promotion gate
moves.

**Stage 1, manual.** Everything up to and including the first fully-Forge production release is
driven by hand: `forge deploy -e prodcheck`, verify, then `-e production`, then
`forge version bulk-upgrade`. Automating a path nobody has walked just moves the debugging into
GitHub Actions.

**Stage 2, automated.** Promote once:

- the fully-Forge version has shipped and settled on real customer sites
- the scope list has stopped moving — no pending permission changes
- the rollout question above has an answer from Atlassian

Accept the drift until then: staging S3 deploys on every push to `main` while Forge deploys by hand,
so the Forge app runs older code than the website. Check the deployed Forge version
(`forge version list -e <env>`) before chasing a host-specific bug.
