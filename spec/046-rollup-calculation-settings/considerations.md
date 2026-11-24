# spec/046 — Considerations

Things to watch out for before building [Team time over dates](./spec.md#team-time-over-dates).

## Team time depends on what the report loaded

**Handled** in [spec.md § The team's other work](./spec.md#the-teams-other-work): options 2 and 1
below, as a checkbox to load the team's other work, with a warning when it is off.

Team time splits each day among the team's **loaded** items. If the team also works on F, and F
overlaps A but isn't in the report, A gets those days to itself and comes out too big. Load F and A
shrinks. The same item gets different sizes in different reports, and changing the JQL changes A's
size without A changing.

The same applies to:

- **In-report filters** (hide Done, status filters) if team time is computed after filtering.
- **Hierarchy gaps**: team time is per level, so a report with only some epics under its
  initiatives sees an incomplete epic level.

Options:

1. **Accept it and say so**: team time means "within this report"; compute it before in-report
   filters and show a note. Cheap, but numbers stay unstable.
2. **Load the team's other work**: per team, query its items whose dates overlap the loaded ones,
   use them only for the calculation. Most accurate; costs more Jira calls, needs a reliable team
   field, and the user may not be able to see all of the team's work.
3. **Use a rule that doesn't depend on other items**: estimate, date span, or the rejected "cap
   at its own pace". Any rule that splits a day among items has this problem.
4. **Detect and warn**: flag items whose team time may be inflated (e.g. the team's loaded
   items cover only part of its velocity).

## A lone item takes every day of its span

An item with nothing overlapping gets the whole team for its full span, whatever its estimate: an
estimate of 2 over a 10-day span gives team time 10. The spec rejected capping at the item's own
pace (it undercounts items that share days), but doesn't address this overshoot. Related to the
issue above: both come from the report not seeing the team's other work.
