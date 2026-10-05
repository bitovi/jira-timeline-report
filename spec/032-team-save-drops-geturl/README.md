# 032 — Saving team settings drops `getUrl`, so every issue link becomes `javascript://`

Saving team configuration replaces the live normalize config with the **base** config, skipping the
one step that attaches `getUrl`. Every issue link in every report silently degrades to
`javascript://` until the page is reloaded.

Found while verifying [031 — editable capacity and tracks](../031-autoscheduler-capacity/README.md)
end to end. **Pre-existing**, not introduced by 031 — but 031's `Commit` button reuses the same save
path, so it is now reachable from inside a report rather than only from the settings sidebar.

---

## Reproduction

Measured on the Auto-Scheduler with 22 issue links (`bitovi-training`, IMP-99/100/123):

| Action                                    | Links                  |
| ----------------------------------------- | ---------------------- |
| Fresh page load                           | 22 real Jira URLs      |
| Change capacity as a what-if override     | 22 real Jira URLs      |
| **Commit** (or any Settings → Teams save) | **22 `javascript://`** |
| Reload                                    | 22 real Jira URLs      |

Overrides alone do not trigger it — only a save does. React logs the accompanying warning:

```
Warning: A future version of React will block javascript: URLs as a security precaution.
```

The symptom is not cosmetic: clicking an issue in any report does nothing until reload.

---

## Root cause

The normalize config is assembled in two stages, in
[route-data.js](../../src/canjs/routing/route-data/route-data.js):

```
fullyInheritedTeamConfigPromise
  → createNormalizeConfiguration(allTeamData)   // baseNormalizeOptions — has NO getUrl
  → configurationPromise({ serverInfoPromise, normalizeObservable })
                                                // ← the ONLY place getUrl is created
  → normalizeOptions                            // what the pipeline normalizes with
```

The second stage, in
[state-helpers.js](../../src/canjs/controls/timeline-configuration/state-helpers.js), is where the
Jira base URL is folded in:

```js
return {
  getUrl({ key }) {
    return serverInfo.baseUrl + '/browse/' + key;
  },
  // …
  ...otherNormalizeParams,
};
```

`normalizeOptions` is declared with `makeAsyncFromObservableButStillSettableProperty`, so it normally
resolves from that promise **but can also be assigned directly**. And that is what the save handler
does — in [TimelineReport.tsx](../../src/react/TimelineReport/TimelineReport.tsx),
`onUpdateTeamsConfiguration` assigns the freshly-saved config straight to the settled property:

```js
rd.normalizeOptions = configuration; // `configuration` is createNormalizeConfiguration(...) — the BASE
```

That skips `configurationPromise` entirely. `getUrl` is now absent, so `normalizeIssue` falls back to
[getUrlDefault](../../src/jira/normalized/defaults.ts), which returns a constant placeholder:

```ts
export function getUrlDefault({ key }: Pick<JiraIssue, 'key'>): NormalizedIssue['url'] {
  return 'javascript://';
}
```

Note it destructures `key` and ignores it — the placeholder is deliberate, meaning "no server info
available." A reload re-enters through `normalizeOptionsPromise` and repairs it.

### Only `getUrl` is actually lost

`configurationPromise` also wraps `getVelocity` and `getParallelWorkLimit` with default fallbacks,
and those wrappers are discarded by the same assignment — but the loss is inert. `normalize.ts`
already defaults both to the same `getVelocityDefault` / `getParallelWorkLimitDefault`, and
`createNormalizeConfiguration` always returns a `Number(...)` (at worst `NaN`, which is not `null`),
so the wrapper's `value != null` fallback could never have fired for that config. **`getUrl` is the
only real casualty.** Worth stating explicitly so a fix is not over-scoped.

---

## Blast radius

- **Every report**, not just the Auto-Scheduler — `url` is on `NormalizedIssue`, so anything
  rendering an issue link is affected.
- **Both deployment modes** — the base URL comes from `serverInfo` in the shared chain.
- **Any team-settings save** — the sidebar's Teams panel has always done this.
- **Sticky under 031.** `CapacityOverrideApplier` captures the post-save config as
  `baseNormalizeOptionsRef`, then re-wraps it on every subsequent override. Once a commit has
  degraded the config, later what-ifs keep rebuilding from the degraded base, so it does not
  self-heal.

Not a security vulnerability: the value is a hard-coded constant with no user data interpolated, and
`javascript://` is an inert no-op. It is a broken-link and forward-compatibility problem — React has
announced it will block `javascript:` URLs outright.

---

## The fix

Keep the two-stage assembly intact on save. Options, in preference order:

1. **Re-run the second stage before assigning** (recommended). Have `onUpdateTeamsConfiguration` pass
   the saved base through `configurationPromise` — the same call `normalizeOptionsPromise` makes —
   and assign the result. Smallest change, single call site, fixes the sidebar and 031's `Commit`
   together. `configurationPromise`'s internal `resolve()` already tolerates a plain object, so the
   saved config can be handed to it directly.

2. **Make the base settable instead.** Write `rd.baseNormalizeOptions` and let the existing derived
   chain recompute `normalizeOptions`. Architecturally the most honest — the save genuinely produces
   a _base_ config, not a final one — but `baseNormalizeOptions` is declared with `async()` and is
   not currently written to from anywhere, so it needs care.

3. **Make the seam impossible to misuse.** Have `createNormalizeConfiguration` return a branded type
   that `normalizeOptions` will not accept, forcing the second stage. Largest change; the right
   long-term answer if this seam bites a third time.

Whichever is chosen, the assignment in `onUpdateTeamsConfiguration` should carry a comment naming
the hazard, because the failure is silent and only visible several components away.

### Acceptance criteria

- [ ] After saving team settings from Settings → Teams, issue links are real Jira URLs — no reload.
- [ ] After 031's `Commit`, the same.
- [ ] A capacity override applied _after_ a commit still yields real URLs (the ref does not re-wrap a
      degraded base).
- [ ] No `javascript:` URL warning in the console during either flow.
- [ ] A regression test asserts `getUrl` survives the save path. A unit test over
      `onUpdateTeamsConfiguration`'s resulting config is enough; it does not need the browser.

---

## Related cleanup (optional, same area)

`hasUrl` in [AutoScheduler.tsx](../../src/react/reports/AutoScheduler/AutoScheduler.tsx) and
`isFullSimulationResult` in
[IssueSimulationRow.tsx](../../src/react/reports/AutoScheduler/IssueSimulationRow.tsx) both test
`'url' in issue.linkedIssue && typeof issue.linkedIssue.url === 'string'`, which reads as a
data-quality check on real issues. It is not one — a real issue can never lack a `url`, since the
field is a non-optional `string` that `normalize.ts` always assigns.

What they actually discriminate is the synthetic plan-finish row built in
[stats-analyzer.ts](../../src/react/reports/AutoScheduler/scheduler/stats-analyzer.ts):

```js
const endDaySimulation: MinimalSimulationIssue = {
  linkedIssue: { summary: 'Due Date', key: '[~DUE DATE~]' },
  // …
};
```

That is the **Due Date** row under Summary — not a Jira issue, with no `url` and no `team`. A named
discriminant (`kind: 'issue' | 'plan-finish'`) would say so directly and stop the guard from looking
like it is defending against absent data.

This is a rename, not a behaviour change, and is independent of the fix above.

---

## Deliberately out of scope

- Changing `getUrlDefault` to throw or return `null` instead of a fake URL. It is a reasonable
  placeholder for the genuinely-no-server-info case; the bug is that we reach it at all.
- Reworking how `normalizeOptions` is stored or how CanJS settable-async properties behave, beyond
  whichever option above is chosen.
- The 031 capacity feature itself, which is correct — it merely reuses the defective save path.
