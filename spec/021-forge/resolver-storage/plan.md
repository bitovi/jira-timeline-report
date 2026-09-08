# Forge storage via a resolver and the Key-Value Store

> Sub-plan of [spec/021](../plan.md). Decides what the Forge host's **default** storage is, and
> therefore whether this app ever grows a backend.
>
> Status: **explored, not built.** Two open questions gate the decision — see
> [Open questions](#open-questions).

## Context

The Forge host currently reuses the web build's storage: a configuration work item, wired as
`createForgeStorage` in `src/jira/storage/index.web.ts`. That was the right call for the spike —
spec/021 Phase 2 says "reuse, don't duplicate" — but it is not viable as the shipping default.

**The app does not create the configuration work item.** When `storageInitialized()` returns false,
`src/react/services/storage/StorageNeedsConfigured.tsx` renders "Team storage has not been
configured" and links to a **GitHub markdown document**, which tells the user to hand-create a Jira
work item titled `Jira Auto Scheduler Configuration`.

Set that against what Connect users have today:

| Host             | Default store           | Setup the user must do             |
| ---------------- | ----------------------- | ---------------------------------- |
| Connect          | app property, via `AP`  | **None**                           |
| Web              | configuration work item | Create one, following a GitHub doc |
| Forge (as built) | configuration work item | Create one, following a GitHub doc |

Forge is meant to _replace_ Connect (spec/021 § end state). Shipping it with the web build's
onboarding would hand every migrating customer a manual setup step they never had. That is the
problem this plan exists to solve.

## Finding: a resolver is mandatory for KVS

Not a preference. `@forge/bridge` — the only Forge package a Custom UI frontend can import — exports
no key-value API at all:

```
$ grep -ric "kvs\|keyvalue" node_modules/@forge/bridge/out/index.d.ts
0
```

`@forge/bridge` exports `invoke`, `requestJira`, `view`, `router`, `flag`, `events`, `realtime` and
an **object store** (blobs, metered per request — the wrong shape for settings JSON). The key-value
store lives in `@forge/kvs`, a runtime package that only executes server-side.

So "use Forge storage" and "add a resolver" are the same decision. There is no frontend-only path.

## What it costs

### The scope is a major version

`@forge/kvs` requires `storage:app` in `permissions.scopes`. Adding a scope makes the next deploy a
**major version**: `forge deploy` refuses without `--approve MAJOR_VERSION_RULE`, and every existing
installation keeps running on the _old_ permission set until a site admin approves the upgrade.

**This is the strongest argument for deciding now rather than later.** There is currently one
installation — Arthur's dev site. Adding `storage:app` today costs nothing. Adding it after the app
has customers is a migration event that every one of them has to action, and until they do, their
install cannot reach the new storage.

### Metering

| Capability        | Free allowance / month | Overage               |
| ----------------- | ---------------------- | --------------------- |
| Function duration | 200,000 GB-seconds     | $0.000025 / GB-second |
| KVS reads         | 0.1 GB                 | $0.055 / GB           |
| KVS writes        | 0.1 GB                 | $1.090 / GB           |

Function duration is not a concern; a storage get/set is milliseconds. **KVS is the concern, and the
reason is the denominator** — per [Forge platform pricing](https://developer.atlassian.com/platform/forge/forge-platform-pricing/)
the allowance is granted per _app_, not per installation. 0.1 GB of writes per month has to cover
every customer on the listing, and this app rewrites the whole `saved-reports` blob on every save
(spec/026 § Context). See [Open questions](#open-questions) — this needs modelling before commitment,
not after.

### Smaller costs

- `app.runtime` stops being inert. It exists in `manifest.yml` today only because the CLI requires
  it; nothing executes on it.
- `app.storage.classifications: [ugc]` — report configurations and JQL are user-generated content.
- Cold starts add latency to the first storage read of a session.
- A second bundle in the build, and a second place bugs can live.

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
`storageInitialized: async () => true`, matching `index.plugin.ts:45`. **That `true` is the entire
point of this plan**: it is what removes the setup step.

So the frontend change is one new factory, `createForgeKvsStorage`, calling `invoke()`. Nothing above
`AppStorage` changes, and neither web nor Connect is touched.

### Files

| Action | Path                              | Notes                                                                                                   |
| ------ | --------------------------------- | ------------------------------------------------------------------------------------------------------- |
| add    | `src/forge-resolver/index.ts`     | `@forge/resolver` with `storage.get` / `storage.set` handlers over `@forge/kvs`                         |
| add    | `src/jira/storage/index.forge.ts` | `createForgeKvsStorage` — `invoke()` against the above                                                  |
| edit   | `manifest.yml`                    | `function` module, `resolver:` on both page modules, `storage:app` scope, `app.storage.classifications` |
| edit   | `src/forge.main.ts`               | swap `createForgeStorage` → `createForgeKvsStorage`                                                     |
| edit   | `package.json`                    | `@forge/resolver`, `@forge/kvs` (neither is a declared dependency today)                                |

### The build wrinkle

Forge bundles the function itself from the manifest's `handler` path — it does not use this repo's
Vite configs. But `src/` here is entirely frontend, and `package.json` declares
`"main": "server.js"` (the Express OAuth server, unrelated). **How Forge resolves a `handler` path
against this layout is unverified** and is the one implementation detail to settle before writing
code. Options, in order of preference:

1. A handler path pointing at a dedicated directory that no Vite config globs.
2. If Forge insists on a conventional location, a thin re-export at the location it wants.

Either way the resolver must not be pulled into `dist/` or `dist-forge/`, and the Vite builds must
not try to bundle `@forge/kvs` (a runtime package that will not resolve in a browser).

### Interaction with spec/026

This changes what Forge's **`legacy`** pointer means, and nothing else:

| Pointer  | Connect       | Web              | Forge (today)    | Forge (this plan) |
| -------- | ------------- | ---------------- | ---------------- | ----------------- |
| `legacy` | app property  | config work item | config work item | **KVS**           |
| `space`  | Reports Space | Reports Space    | Reports Space    | Reports Space     |

Reports Space stays available and unchanged — it is pure REST through the request helper and needs no
resolver ([spec/021 § Saved-reports storage on Forge](../plan.md#saved-reports-storage-on-forge-spec026)).
Users who want cross-host sharing or no 32 KB ceiling still opt into it; users who want to install and
go get KVS with no setup.

The `reports-storage-config` pointer itself would also move to KVS, which is consistent: it is
per-host by design.

## Alternatives considered

| Option                              | Why not                                                                                                                                                                                                                                                                                                                                |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Configuration work item** (today) | Manual setup via a GitHub doc. An onboarding regression against Connect, at exactly the moment users are being asked to migrate. Stays as a fallback, not the default.                                                                                                                                                                 |
| **Connect app properties**          | Would be strictly better — zero setup _and_, under incremental adoption, possibly carries existing Connect users' data across. But `/rest/atlassian-connect/1/addons/…` is a Connect-only resource and reachability from a Forge module is unverified. **Check this before building anything here** (spec/021 README open question 2). |
| **Object Store** (`@forge/bridge`)  | Frontend-accessible, so no resolver — but it is a blob store metered per request (5,000/month free), designed for files. Wrong shape for a settings document read on every boot.                                                                                                                                                       |
| **Reports Space as the default**    | Requires the user to nominate an existing space and needs Jira write permission in it. Same class of setup step as the config work item, and spec/026 deliberately keeps `legacy` as the default for that reason.                                                                                                                      |

## Open questions

Both must be answered before building. Either one can invalidate this plan.

1. **Can a Forge module read Connect app properties?** If yes, this plan is probably unnecessary: no
   resolver, no scope change, no metering, and a real chance of carrying existing customers' saved
   data across at cutover. Cheap to test against the deployed dev app. **Answer this first.**
2. **What is the KVS per-value size limit, and is the free allowance really per-app?** spec/026
   exists because a 32 KB ceiling on the Connect app property was capping sites at ~73 reports. If
   KVS has a comparable per-value limit, this plan solves onboarding but not the ceiling — and if
   0.1 GB of monthly writes is shared across the whole customer base rather than per install, the
   economics need modelling before commitment.

A third, lower-stakes: does the `storage:app` scope show up in the install screen in a way that
needs explaining to customers? Adding a permission is something admins see and evaluate.

## Verification

Unit:

- `createForgeKvsStorage` round-trips a value through a mocked `invoke`
- `storageInitialized()` returns `true` without touching Jira — the no-setup guarantee
- an unknown key returns the `defaultShape`, matching the other two factories

End to end, on a real site:

1. Fresh install, no configuration work item anywhere → app boots and saves a report with **no
   setup step**. This is the whole point; if it fails, nothing else matters.
2. Every settings surface round-trips through a reload: theme, features, teams, font, saved reports.
3. Switch the pointer to a Reports Space, confirm reports move and the pointer itself persists in KVS.
4. `forge deploy` refuses without `--approve MAJOR_VERSION_RULE`, and the install shows the new scope
   for approval — confirm the major-version path behaves as documented before relying on it.
5. Web and Connect unaffected: `npm run test`, `npm run typecheck`, `npm run build`, plus a manual
   load of both builds.

## Explicitly out of scope

Custom entities and the query API (KVS key-value is enough for these keys), the secret store,
migrating existing Connect or web data into KVS, and any change to how web or Connect store anything.
