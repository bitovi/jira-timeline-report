# Forge storage via a resolver and the Key-Value Store

Saved reports, team settings and theme live in **Connect app properties**, and those still work on
Forge — the Forge build reads and writes the exact same properties the Connect build always did
([details](#where-storage-stands-today)). That was chosen on purpose: a customer upgrading from
Connect to Forge keeps their data with no migration and no setup step. The downside carries over too:
Connect's **32 KB per-value limit** remains ([why](#why-kvs-is-still-on-the-table)). Saved reports
have a way around it — Forge and Connect both support **Reports Spaces**, one Jira work item per
report — but team settings, theme and feature flags are each still stuck in a single 32 KB property.

Forge's own Key-Value Store removes that ceiling outright: 240 KiB per value, no cap on the number of
keys, and no Connect dependency. This plan is how we get there once the fully-Forge release has
shipped — it needs a backend resolver, the `storage:app` scope, and a new storage factory
([what gets built](#what-gets-built)). The costs are smaller than they look: no Atlassian review, one
customer admin-approval round ([approvals](#the-scope-and-who-has-to-approve-it)), and single-digit
dollars a month in usage ([metering](#metering)). We are not starting it until the fully-Forge release
clears Marketplace review — that ships first, and nothing else moves until it lands
([sequencing](#what-gates-this-now)).

> Sub-plan of [spec/021](../plan.md). Decides what the Forge host's storage is, and therefore whether
> this app ever grows a backend.
>
> Status: **explored, not built.** Forge ships on Connect app properties instead. Start this once the
> fully-Forge release is approved — see [sequencing](#what-gates-this-now).

## Where storage stands today

Every host implements the same three-method `StorageFactory` (`src/jira/storage/common.ts`), so the
keys are identical across all three. Only the backing store differs.

| Key                      | Connect (`index.plugin.ts`) | Forge (`index.forge.ts`) | Web (`index.web.ts`) |
| ------------------------ | --------------------------- | ------------------------ | -------------------- |
| `saved-reports`          | app property, one blob      | **same app property**    | config work item     |
| `all-team-data`          | app property                | **same app property**    | config work item     |
| `theme` / `themeFont`    | app property                | **same app property**    | config work item     |
| `features`               | app property                | **same app property**    | config work item     |
| `reports-storage-config` | app property                | **same app property**    | config work item     |

Connect goes through `AP.request`, Forge through `requestJira`, but both resolve to
`/rest/atlassian-connect/1/addons/{appKey}/properties/{key}` — the same bytes. That is what
`app.connect.key` buys, and why the cutover needs no migration.

A Forge front end can read _and write_ Connect app properties with no resolver — verified 2 Sep on
`prodcheck` ([status-2026-09-02.md](../next-steps/status-2026-09-02.md#question-3-answered-yes-read-and-write)),
and shipped as `createForgeConnectStorage` (`src/forge.main.ts:132`).

**That is why this plan is shelved.** It was written to fix an onboarding regression — Forge was
reusing the web build's configuration work item, which the app does not create, so a migrating
customer would have had to hand-create a Jira issue by following a GitHub doc. Reaching app
properties removed that for free: `storageInitialized()` returns `true` and there is no setup step.

## Why KVS is still on the table

Because moving to Forge bought zero extra storage space.

| Store                  | Per value              | How many          | Reports ceiling |
| ---------------------- | ---------------------- | ----------------- | --------------- |
| Connect app property   | 32 KB                  | 100 per site      | **~73**         |
| Config work item (web) | ~32 KB across all keys | 1 issue           | worse           |
| Reports Space          | ~32 KB per report      | unlimited issues  | none            |
| **Forge KVS**          | **240 KiB**            | no documented cap | none            |

`saved-reports` holds the whole collection in one value (`src/jira/reports/backend/legacy.ts`), so we
die on value size, not property count — we use ~6 of 100. That is the 32 KB ceiling
[spec/026](../../026-storage-saved-reports/plan.md) exists to work around, and it is unchanged by
Forge.

**Reports Space** is spec/026's opt-in alternative: one Jira work item per saved report, in a project
the user nominates (`src/jira/reports/backend/space.ts`). Ordinary REST, so all three hosts read the
same reports. `reports-storage-config` is the per-host pointer that selects it.

Two reasons remain to want KVS:

1. **The ceiling**, for installs that do not opt into a Reports Space.
2. **Connect EOS.** App properties are a Connect resource reached through a Connect key. If they stop
   being supported in Dec 2026, this is not optional — see [What gates this now](#what-gates-this-now).

## Finding: a resolver is mandatory for KVS

Not a preference. `@forge/bridge` — the only Forge package a Custom UI frontend can import — exports
no key-value API at all:

```
$ grep -ric "kvs\|keyvalue" node_modules/@forge/bridge/out/index.d.ts
0
```

It exports `invoke`, `requestJira`, `view`, `router`, `flag`, `events`, `realtime` and an **object
store** (blobs, metered per request — the wrong shape for settings JSON). The key-value store lives
in `@forge/kvs`, a runtime package that only executes server-side.

So "use Forge storage" and "add a resolver" are the same decision. There is no frontend-only path.

## What it costs

### The scope, and who has to approve it

`@forge/kvs` requires `storage:app` in `permissions.scopes`. Three different approvals get conflated
here — only one of them is Atlassian, and it is not triggered by scopes:

| Gate                     | Triggered by                 | Cost                                                              |
| ------------------------ | ---------------------------- | ----------------------------------------------------------------- |
| `forge deploy --approve` | the CLI's own lint rule      | Local acknowledgement. Nothing external.                          |
| **Atlassian review**     | **free→paid licensing only** | **Not triggered by a scope change.** Those publish automatically. |
| Customer admin approval  | any scope increase           | Every install stays on the old scope set until an admin approves. |

[Upgrade and version cloud apps](https://developer.atlassian.com/platform/marketplace/upgrading-and-versioning-cloud-apps/):
a scope increase means "Marketplace updates happen automatically (no approval necessary), but
customers need to approve the changes to continue using your app." Only a licensing change "triggers
a Marketplace approval" — which is what queued v3 and v4, not scopes.

Whether this lands as a major or minor version is unsettled: the Connect rule puts scope changes at
**major**, and the same page carries a separate Forge table putting them at **minor**. It does not
affect the decision — the review cost is zero either way, and the only thing deferring costs is one
admin-approval round.

### Metering

|                        | Scope                           | Value                               |
| ---------------------- | ------------------------------- | ----------------------------------- |
| Free billing allowance | **per app**, all installs share | 0.1 GB reads, 0.1 GB writes / month |
| Rate limits            | **per installation**            | 1000 RPS, 4000 reads+writes / min   |

Overage is billed to **us**, not the customer — consolidated into one monthly invoice for the
Developer Space. At $1.09/GB writes and $0.055/GB reads:

- 100 customers × 100 saves × 240 KiB ≈ **$2.60/month**
- 1000 customers, 15M page loads ≈ **$33/month** in reads

**Cost is not a reason to avoid KVS.** The per-app denominator looks alarming until it is modelled;
modelled, it is single-digit dollars. Sharding one key per report cuts writes ~50× further — writing a
5 KB report instead of rewriting the whole collection on every save — and removes the ceiling at the
same time.

Caveat: request sizes round up to the nearest 10 KB for rate-limit accounting; whether billing rounds
the same way is unconfirmed. At this scale it does not change the conclusion.

### Smaller costs

- `app.runtime` stops being inert. It exists in `manifest.yml` today only because the CLI requires it.
- `app.storage.classifications: [ugc]` — report configurations and JQL are user-generated content.
- Cold starts add latency to the first storage read of a session.
- A second bundle in the build, and a second place bugs can live.
- **Forge-only.** The web build cannot read KVS, so it cannot be the cross-host store the Reports
  Space already is.

### What it buys back

- **Isolation by the platform.** KVS is namespaced per app installation — "only your app can read and
  write your stored data"
  ([docs](https://developer.atlassian.com/platform/forge/storage-reference/kvs/)). No tenant id to get
  wrong, no cross-site leak possible. Stronger than app properties, which sit behind a shared
  `app.connect.key`.
- **Runs on Atlassian.** Atlassian-hosted with no egress, so it moves the app _further inside_
  eligibility, not out of it.

## What gets built

### The seam already exists

`StorageFactory` (`src/jira/storage/common.ts`) is three methods:

```ts
{
  get: <TData>(key: string, defaultShape?: unknown) => Promise<TData | null>;
  update: <TData>(key: string, value: TData) => Promise<void>;
  storageInitialized: () => Promise<boolean>;
}
```

KVS maps onto it almost exactly — `kvs.get(key)` / `kvs.set(key, value)` — and
`storageInitialized: async () => true`, matching what `createForgeConnectStorage` already returns. So
the frontend change is one new factory, `createForgeKvsStorage`, calling `invoke()`. Nothing above
`AppStorage` changes, and neither web nor Connect is touched.

### Files

| Action | Path                              | Notes                                                                                                   |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| add    | `src/forge-resolver/index.ts`     | `@forge/resolver` with `storage.get` / `storage.set` handlers over `@forge/kvs`                         |
| edit   | `src/jira/storage/index.forge.ts` | add `createForgeKvsStorage` alongside the existing `createForgeConnectStorage` — keep both              |
| edit   | `manifest.yml`                    | `function` module, `resolver:` on both page modules, `storage:app` scope, `app.storage.classifications` |
| edit   | `src/forge.main.ts:132`           | swap `createForgeConnectStorage` → `createForgeKvsStorage`                                              |
| edit   | `package.json`                    | `@forge/resolver`, `@forge/kvs` (neither is a declared dependency today)                                |

**Keep `createForgeConnectStorage`.** It is the only reader of existing customers' data, and any
migration path has to read from it and write to KVS.

### The build wrinkle

Forge bundles the function itself from the manifest's `handler` path — it does not use this repo's
Vite configs. But `src/` here is entirely frontend, and `package.json` declares `"main": "server.js"`
(the Express OAuth server, unrelated). **How Forge resolves a `handler` path against this layout is
unverified** and is the one implementation detail to settle before writing code. Options, in order of
preference:

1. A handler path pointing at a dedicated directory that no Vite config globs.
2. If Forge insists on a conventional location, a thin re-export at the location it wants.

Either way the resolver must not be pulled into `dist/` or `dist-forge/`, and the Vite builds must not
try to bundle `@forge/kvs` (a runtime package that will not resolve in a browser).

### Interaction with spec/026

This changes what Forge's **`legacy`** pointer means, and nothing else:

| Pointer  | Connect       | Web              | Forge (today)    | Forge (this plan) |
| -------- | ------------- | ---------------- | ---------------- | ----------------- |
| `legacy` | app property  | config work item | **app property** | **KVS**           |
| `space`  | Reports Space | Reports Space    | Reports Space    | Reports Space     |

Reports Space stays available and unchanged — it is pure REST through the request helper and needs no
resolver. It remains the only option where web, Connect and Forge see the same saved reports.

## Alternatives considered

| Option                             | Why not                                                                                                                                                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Connect app properties** (today) | **Adopted, and the reason this plan is shelved.** Zero setup, and it carries existing customers' data across untouched. Its limits are the 32 KB ceiling and its dependence on Connect EOS. |
| **Configuration work item**        | Manual setup via a GitHub doc — an onboarding regression against Connect. Superseded; the web host's store only.                                                                            |
| **Object Store** (`@forge/bridge`) | Frontend-accessible, so no resolver — but a blob store metered per request, designed for files. Wrong shape for a settings document read on every boot.                                     |
| **Custom Entity Store**            | Typed attributes and indexes we do not need for six keys. Same resolver and scope cost as KVS.                                                                                              |
| **Reports Space as the default**   | Requires the user to nominate a space and write permission in it. Same class of setup step as the config work item; spec/026 keeps `legacy` as the default for that reason.                 |

## What gates this now

Settled:

| Question                                        | Answer                                                                                               |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| Can a Forge module read Connect app properties? | **Yes**, read and write, front end, no resolver — verified 2 Sep on `prodcheck`.                     |
| KVS per-value limit? Allowance per app?         | **240 KiB per value**, no documented key cap. Allowance **is** per app — and the cost is negligible. |

So nothing technical is in the way. **The gate is sequencing:** the fully-Forge release is what ships
first, and it is in Marketplace review. Anything that does not block removing the Connect modules gets
punted until that lands — start this after it is approved.

One question still sets the _urgency_, not the go/no-go. Queued for the reviewer in
[release-runbook.md § Step 7](../next-steps/release-runbook.md):

**Are Connect app properties supported past Connect end of support in Dec 2026?**

- **If yes** — KVS is an improvement we schedule. Reports Space covers anyone who hits the ceiling
  meanwhile.
- **If no** — KVS plus a migration off app properties becomes a deadline item with a hard date. See
  [status-2026-09-02.md § After the transition](../next-steps/status-2026-09-02.md#after-the-transition-move-new-installs-to-forge-kvs).

## Verification

Unit:

- `createForgeKvsStorage` round-trips a value through a mocked `invoke`
- `storageInitialized()` returns `true` without touching Jira
- an unknown key returns the `defaultShape`, matching the other factories

End to end, on a real site:

1. Fresh install → app boots and saves a report with **no setup step**.
2. Every settings surface round-trips through a reload: theme, features, teams, font, saved reports.
3. Switch the pointer to a Reports Space, confirm reports move and the pointer itself persists in KVS.
4. Confirm the deployed version number and that the install prompts for the new scope — this is also
   how we learn whether Forge classifies a scope add as major or minor.
5. Web and Connect unaffected: `npm run test`, `npm run typecheck`, `npm run build`, plus a manual
   load of both builds.

## Explicitly out of scope

Custom entities and the query API, the secret store, and any change to how web or Connect store
anything. **Migrating existing Connect app-property data into KVS is out of scope here** — it is the
deadline item above, and needs its own plan.
