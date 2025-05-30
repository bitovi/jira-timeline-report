## Overview

This report is used to generate a high level overview of upcoming milestones as something
that can be put in a PowerPoint or Google Slide.

## Privacy Policy

This project does NOT save any JIRA data. In fact, other than transporting an access token
to the browser, no JIRA data even flows through our servers.

All the code is open source in [Github Issue](https://github.com/bitovi/jira-timeline-report) so you can verify this yourself or host it yourself.

## Need Help or Have Questions?

This project is supported by Bitovi, an [Agile Project Management consultancy](https://www.bitovi.com/services/agile-project-management-consulting). For bugs or feature requests, please submit a [Github Issue](https://github.com/bitovi/jira-timeline-report/issues).

You can get help or ask questions on our:

- [Discord](https://discord.gg/J7ejFsZnJ4)
- [Twitter](https://twitter.com/bitovi)

## Getting Started

Bitovi's [Agile Project Management with Jira - Reporting](https://www.bitovi.com/academy/learn-agile-program-management-with-jira/reporting.html) training walks through
configuring the tool.

Note, your epics and initiatives will need the following statuses for the tool to work:

- `Idea`, `To Do`, or `Open` representing ideas that you might not want on the report.
- `QA` or `In QA` - represending work that is in QA.
- `Partner Review` or `UAT` - representing work that is in user acceptance testing.
- `Blocked` - represending work that can not move forward.
- `Done` or `Cancelled` - Work that is complete and will be hidden from the report.

The [Agile Project Management with Jira - Continuous Exploration](https://www.bitovi.com/academy/learn-agile-program-management-with-jira/continuous-exploration-board.html) training has
videos on how to create an initiative type with the right statuses.

## How Timing is Calculated

Initiative timing is calculated from **epic** `Start date` and `Due date` fields. Initiative dates are _ignored_.
If the **epic** does not have a `Start date` or `End date`, the stories within the **epic** can be used to determine
the timing of the **epic**. In this case, the latest story's end date will be used as the epic's `End date`
and the earliest story's start date will be used as the epic's `Start date`.

Story timing itself is determined from:

- The `Start date` and `End date` of the story; or if these don't exist
- The story's sprints

**NOTE:** To use story timing, you must use a JQL that includes stories.

## Labeling epics as QA or UAT

To label epics as part of an initiative's QA or UAT timing, add a `Label` that includes the characters `QA` or `UAT`.
