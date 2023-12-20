# Jira Timeline Report 

The [Jira Timeline Report](https://timeline-report.bitovi-jira.com/) creates easy-to-understand 🧠, power-point-ready 🖥️ timeline reports!

![image](https://github.com/bitovi/jira-timeline-report/assets/78602/107a6202-db5f-43c0-9133-56c6e4f260d4)

It can:

- Show how your timeline has changed 📈
- Break out work by "dev", "qa" and "uat" timelines 📊
- Roll up work into releases 📶

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

Clone the application into your local machine.

```sh
git clone https://github.com/bitovi/jira-integrations.git
cd jira-integrations
```

### Getting Environment Variables

The next step is to fill in your environment variables. You can use the .env.example to create your .env in your root folder

```sh
cp .env.example .env
```

Your environment variables can be gotten from Jira following the steps below

- Open Jira developer console. https://developer.atlassian.com
- Navigate to the developer console, it can be found on the top right corner of the screen.
- Create your app and choose OAuth2.0, put in the app name and accept the terms.
- Click Permissions, add the Jira API scope then configure it. Ensure to include the scopes you want and save.
- Click Authorization, input the callback url, as default for this application locally, use `http://localhost:3000` (be sure to match the PORT in the server if you changed it) and save.
- Find Settings and scroll down to copy your CLIENT_ID and CLIENT_SECRET.
- The CLIENT_JIRA_API_URL is `https://api.atlassian.com`.

Note: All environment variables that start with `CLIENT` will be sent to the client side and exposed.

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
