# Jira Timeline Report 


The [Jira Timeline Report](https://timeline-report.bitovi-jira.com/) creates easy-to-understand 🧠, power-point-ready 🖥️ timeline reports!

![image](https://github.com/bitovi/jira-timeline-report/assets/78602/107a6202-db5f-43c0-9133-56c6e4f260d4)

It can:

- Show how your timeline has changed 📈
- Break out work by "dev", "qa" and "uat" timelines 📊
- Roll up timing data from stories, sprints, epics, initiatives and releases 📶

![image](https://github.com/bitovi/jira-timeline-report/assets/78602/20628f19-f1ea-4815-a44b-50c0efa13d12)

## Privacy Policy

This project does NOT save any JIRA data.  In fact, other than transporting an access token
to the browser, no JIRA data even flows through our servers.  

All the code is open source in [Github](https://github.com/bitovi/jira-timeline-report) so you can verify this yourself or host it yourself.


## Need Help or Have Questions?

This project is supported by Bitovi, an [Agile Project Management consultancy](https://www.bitovi.com/services/agile-project-management-consulting). For bugs or feature requests, please submit a [Github Issue](https://github.com/bitovi/jira-timeline-report/issues).

You can get help or ask questions on our:

- [Discord](https://discord.gg/J7ejFsZnJ4)
- [Twitter](https://twitter.com/bitovi)

## Getting Started

Bitovi's [Agile Project Management with Jira - Reporting](https://www.bitovi.com/academy/learn-agile-program-management-with-jira/reporting.html) training walks through 
configuring the tool.

## Configuration

The following documents how to configure the tool.

### Issue Source

> <img width="855" alt="image" src="https://github.com/bitovi/jira-timeline-report/assets/78602/cf039a24-5bfd-4ba4-9baf-59bb5f49f294">

Specify a `JQL` that loads all issues you want to report on and help determine the timeline of your report. The report will load faster the fewer issues you load.

Examples:

- The following loads all Epics and Stories in your jira instance:

  ```
  issueType in (Epic, Story) order by Rank
  ```

  > NOTE: Specifying `order by Rank` will list items in Rank order. This can be useful if you are using `Rank` to prioritize your issues.


- The following loads all children of the issue `PROJ-1`.

  ```
  issuekey in portfolioChildIssuesOf("PROJ-1") order by Rank
  ```

  > NOTE: `portfolioChildIssuesOf` is only available with advanced roadmaps.


### Primary Timeline

> <img width="794" alt="image" src="https://github.com/bitovi/jira-timeline-report/assets/78602/f4cc9ae5-3d51-4e0e-beac-76744eec39f4">

The primary timeline settings configure the main chart.  It has two parts.

#### What Jira artifact do you want to report on?

This configures the __primary__ Jira artifact that be reported in the main chart.  

#### What timing data do you want to report?

This configures the type of report.  The options:

- _Start and due dates_ - Create a chart that shows the start and due date for each of the __primary__ Jira artifacts.
- _Due dates only_ - Create a chart that shows only the due dates of the __primary__ Jira artifacts.
- _Work breakdown_ - Create a _start and due date_ chart, but show the start and due dates for work identified as "dev", "qa" or "uat".  See [Understanding Work Breakdown](#understanding-work-breakdown) for more info.

### Timing Calculation

> <img width="852" alt="image" src="https://github.com/bitovi/jira-timeline-report/assets/78602/41d41fb4-435a-4856-952c-97e2e3922f58">

The timing calculation section allows you to specify:

- How timing is "rolled up" across issue hierarchy.
- What issue type releases should report on

## Old Stuff

Note, your epics and initiatives will need the following statuses for the tool to work:

- `Idea`, `To Do`, or `Open` representing ideas that you might not want on the report.
- `QA` or `In QA` - represending work that is in QA.
- `Partner Review` or `UAT` - representing work that is in user acceptance testing.
- `Blocked` - represending work that can not move forward.
- `Done` or `Cancelled` - Work that is complete and will be hidden from the report.

The [Agile Project Management with Jira - Continuous Exploration](https://www.bitovi.com/academy/learn-agile-program-management-with-jira/continuous-exploration-board.html) training has 
videos on how to create an initiative type with the right statuses. 



## How Timing is Calculated

Initiative timing is calculated from __epic__ `Start date` and `Due date` fields. Initiative dates are _ignored_.
If the __epic__ does not have a `Start date` or `End date`, the stories within the __epic__ can be used to determine 
the timing of the __epic__. In this case, the latest story's end date will be used as the epic's `End date`
and the earliest story's start date will be used as the epic's `Start date`.

Story timing itself is determined from:

- The `Start date` and `End date` of the story; or if these don't exist
- The story's sprints


__NOTE:__ To use story timing, you must use a JQL that includes stories.  



## Labeling epics as QA or UAT

To label epics as part of an initiative's QA or UAT timing, add a `Label` that includes the characters `QA` or `UAT`.





## Contributing

See [Contributing](CONTRIBUTING.md)

### Navigating the Files

- The server folder contains a `server.js` which bootstraps an express application that renders the application
- It has an endpoint that fetches the access token from Jira and refreshes the access token when expired.
- The `pages` folder contains the html files that are rendered.
- The `public` folder contains the javascript files that are included in the html files.
- The `jira-oidc-helpers` is a javascript file with all the helpers required to interact with Jira and save your access and refresh tokens to `localStorage`.
- You will make changes to the `main.js` files based on your use case. Everything you need to make your request has been layered in `jira-oidc-helpers`.
- Call the `jiraFetch` helper with the url path you want from your main and handle the data how you see fit. e.g

```js
const issue = await jiraHelper.jiraFetch(urlPath);
```
