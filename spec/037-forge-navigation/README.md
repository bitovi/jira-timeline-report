# 037 — Forge navigation: killing the double sidebar

Jira's nav4 gives every app a persistent left rail. We render a second one inside the iframe, so
there are two vertical rails and ~390 px of chrome before the report starts.

- [mockups/forge-navigation.html](./mockups/forge-navigation.html) — every option, side by side.
  Open it in a browser.

Status: **design exploration**. No plan yet — waiting on the option decision.

---

## The platform facts this design rests on

|                         | Sub-pages in Jira's rail?                                                                                                                                                                               |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Forge `jira:globalPage` | **Yes** — `pages` (flat) or `sections` (grouped with headers). Each `{ title, route, icon }`; the route is appended to `/jira/apps/{appId}/{envId}` and resolved internally via `view.createHistory()`. |
| Connect `generalPages`  | **No** — only `location` + `weight`. One flat nav entry, no children.                                                                                                                                   |

Connect is also end-of-support (no new Connect apps on Marketplace; all new extensibility is
Forge-only). So this lands with the Forge migration ([spec/021-forge](../021-forge/)), and Connect
keeps today's in-app sidebar unchanged.

## The shape

Hand all six settings panels to Jira's rail as sub-pages, and split them by **behaviour**, not just
by topic:

- **Report settings (Sources, Timing)** — render the report with a rail open over it. You're tuning
  the thing in front of you.
- **Global settings (Teams, Features, Theme, Storage)** — render a full page. You're leaving the
  report.

Forge only gives us routes; it has no opinion about what a route renders, so this split costs
nothing at the manifest level.

The parent nav item **is** the report — no redundant `Report` sub-page, matching how Jira's own
Spaces nav works (the space name is the link, the chevron is a separate expand control).

The key property: the second rail becomes **transient** rather than permanent. That was the actual
problem — not that a second rail can ever exist.

## Options mocked

- **2a / 2b** — flat `pages` vs. grouped `sections`.
- **A1 / A2 / A3** — Sources opens _over_ the report: right drawer from the controls bar, popover,
  or left rail opened from the nav.
- **B1 / B2 / B3** — Sources lives _in_ the page: persistent JQL bar + options popover, collapsed
  query chips that expand in place, everything inline.

Current recommendation is **2b + A3** (nav item opens a left rail), with **A1** as the fallback if
the spike below goes badly. B2's collapsed chip row remains a good later addition to either.

## Blocking unknown — verify first

The design assumes **clicking a sub-page does not remount the app**. Our report costs a full issue
load, so a remount per navigation makes sub-pages unusable — and it kills A3 specifically, whose
trigger _is_ a route change. A1's trigger is in-app and survives either way.

The docs imply no remount — `view.createHistory()` exposes a `listen(location, action)` callback,
and the global page doc says the sidebar "will only change the global page URL, you will need to
handle routes inside your app" — but this is **not verified**.

The sharper risk is the **query string**: our report state is query params, Forge sub-page routes
are path segments, and a sidebar click likely pushes only a `pathname`. If `search` is dropped, a
round trip to Teams silently wipes the user's report.

Two smaller unknowns: whether the parent nav item is independently clickable or expand-only, and
whether our left rail can meet Jira's cleanly enough not to read as two rails.

All four are answerable today with a throwaway Forge app on a dev site. See §7 of the mockup.

## Recent reports — not possible in the nav

`pages` and `sections` are declared in `manifest.yml` and are static at deploy time;
`displayConditions` only toggles visibility, it can't render a per-user list. The module that can do
this, `global:ui`, is EAP, UI Kit-only, contractually barred from production use, and moves the app
out of Jira's nav into the site app switcher entirely.

So recents belong in the existing **Saved reports** menu, and the parent nav item should resume the
last-viewed report rather than landing on an empty "Configure a JQL" state.

## Open questions

See §8 of the mockup: whether report-scoped settings pages need a "for: &lt;saved report&gt;"
indicator, and whether Connect diverges or freezes.
