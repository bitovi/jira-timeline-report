## Overview

This report is used to generate a high level overview of upcoming milestones as something
that can be put in a PowerPoint or Google Slide.

There are two different versions:

- A summary view that gives a broad picture of each release and its features
- A detailed view that includes the timing and status of each feature's QA and UAT workflows

## Privacy Policy

This project does NOT save any JIRA data.  In fact, other than transporting an access token
to the browser, no JIRA data even flows through our servers.  

All the code is open source in [Github Issue](https://github.com/bitovi/jira-timeline-report) so you can verify this yourself or host it yourself.


## Need help or Have Questions?

This project is supported by Bitovi, an Agile Project Management consultancy. For bugs or feature requests, please submit a [Github Issue](https://github.com/bitovi/jira-timeline-report/issues)

You can get help or ask questions on our:

- [Slack Community](https://www.bitovi.com/community/slack)
- [Twitter](https://twitter.com/bitovi)


## Issue configuration


In summary, initiatives need to have a `Fix version` and children epics that have a `Start date` and `Due date`. Use
`Labels` to indicate what type of work the epic is.

You __MUST__ have the following issue types and fields to create the roadmap view:

- Initiatives - Represents a feature.
	- `summary` - The summary of the initiative.
	- `Fix versions` - The release this initiative belongs to.
- Epic - Represents a collection of work
	- `Start date` - The start of the work
	- `Due date` - The end of the work
	- `Labels` - If there is a label with `UAT` or `QA` it is considered this type of work. All other epics are considered "dev" epics.
	- `Parent Link` - Epics must link back to their parent

The following are optional and provide more data:

- Epic
	- `Story Points` - Estimated number of points
	- `Confidence` - Our confidence on the estimate



## How timings are calculated

All timings 'roll up' from the epics. Any timing data on initiatives is ignored. For a given initiative,
the "dev" timing is the `Start date` of the earliest "dev" epic and the end date of
the "dev" epic with the latest `Due date`. The same happens for QA and UAT timing.

A similar thing happens for release timing. A release's "dev" timing starts with the earliest "dev" epic across all
of the release's dev epics and ends with the `End date` of the latest epic. The same happens for QA and UAT timing.

## How is status calculated

Keeping statuses consistent across epics and initiatives can be hard. This tool tries to
account for that. For example, if an initiative's _dev_ epics are all past __InDev__, the initiative
will be marked as "dev complete" even if the initiative itself doesn't have a status past "development". The tool
will also give a warning!

Internally, the tool maps all JIRA statues to its own work statuses:

- `Todo`, `In Development` map to __InDev__
- `QA`, `In QA`, `QA Complete` map to __InQA__
-  `Partner Review`, `UAT` map to __InUAT__
- `Done`, `Cancelled` map to __InDone__
- `Blocked` map to __InBlocked__

This tool uses the work statuses and timings to calculate which status to show

- initiative
	- _dev_ status
		- Complete - if the initiative's status is past __InDev__ or all of its _dev_ epics are past __InDev__.
		- Blocked - if any _dev_ epic is __InBlocked__. (might want to enable this on the initiative too)
		- Unknown - if there is no `Due date`
		- Behind - if `Due date (last period)` is greater than `Due date`.
		- NotStarted - if the first _dev_ epic's `Start date` is in the future.
		- OnTrack - otherwise
	- _qa_ status - works just like _dev_ status except it uses _qa_ epics and checks for statuses beyond __InQA__.
	- _uat_ status - works just like _dev_ status except it uses _uat_ epics and checks for statuses beyond __InUAT__.
	- initiative's status
		- Complete - if the initiative's status is __InDone__ or all know _dev_, _qa_, and _uat_ work is Complete; else
		- Blocked - if any _dev_, _qa_, and _uat_ work is Blocked; else
		- Unknown - if there is no `Due date` to any epic; else
		- Behind - if the latest epic's `Due date (last period)` is greater than `Due date`; else
		- NotStarted - if the earliest epic's `Start date` is in the future; else
		- OnTrack - otherwise
- release
	- _dev_ status - Works just like an initiative's _dev_ status, except it does not look at the release's status.
	- _qa_ status - Works just like an initiative's _qa_ status, except it does not look at the release's status.
	- _uat_ status - Works just like an initiative's _uat_ status, except it does not look at the release's status.
	- releases's status - Matches the status of the latest, "long-pole" initiative, unless it's "NotStarted"; else shows "OnTrack" or "Unknown"

## Debugging

At the end of this page, there is a detailed breakdown.  
