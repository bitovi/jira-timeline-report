# Status Reports for Jira

**Status Reports for Jira** creates stunning, branded status reports for your Jira projects. It offers customizable designs to showcase progress and timelines.

![Banner](https://github.com/user-attachments/assets/58e0f507-8a39-49e8-9a30-a6122ac76719)

For guides and comprehensive documentation, checkout the [project's official wiki](https://bitovi.atlassian.net/wiki/spaces/StatusReportsForJira/overview).

## Quick Start

**Prerequisites:** Node.js 22.9.0 (`nvm install && nvm use`) — or use Docker / a Dev Container (no local Node needed).

```sh
git clone https://github.com/bitovi/jira-timeline-report.git
cd jira-timeline-report
npm run setup      # creates .env, installs deps, checks credentials
npm run dev        # web app at http://localhost:5173
```

The full app needs Jira OAuth credentials. We use a **shared dev OAuth app** — if
`VITE_JIRA_CLIENT_ID` / `JIRA_CLIENT_SECRET` are blank in your `.env`, ask in the
team room for them (or create your own app, see [CONTRIBUTING.md](CONTRIBUTING.md)).

**No credentials? Work on UI with mock data — no login required:**

```sh
npm run storybook  # component explorer at http://localhost:6006
```

**Other ways to run:**

- **Docker (live-reload)** — no local Node required: `npm run docker:dev`
- **Dev Container** — open in VS Code and "Reopen in Container" (auto-installs everything)
- **AI agent** — ask Copilot/Claude to run the `launch-dev` agent to set everything up for you

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full setup, including running inside Jira.

## Need Help or Have Questions?

This project is supported by Bitovi, an [Agile Project Management consultancy](https://www.bitovi.com/services/agile-project-management-consulting). For bugs or feature requests, please submit a [Github Issue](https://github.com/bitovi/jira-timeline-report/issues).

You can get help or ask questions on our:

- [Discord](https://discord.gg/J7ejFsZnJ4)
- [Twitter](https://twitter.com/bitovi)

## Contributing

See [Contributing](CONTRIBUTING.md)

### Navigating the Files

- The server folder contains a `server.js` which bootstraps an express application that renders the application
- It has an endpoint that fetches the access token from Jira and refreshes the access token when expired.
- The `pages` folder contains the html files that are rendered.
- The `public` folder contains the javascript files that are included in the html files.
- The `jira-oidc-helpers` is a collection of modules with all the helpers required to interact with Jira and save your access and refresh tokens to `localStorage`.
- You will make changes to the `main-helper.js` files based on your use case. Everything you need to make your request has been layered in `jira-oidc-helpers`.
- Call the `jiraFetch` helper with the url path you want from your main and handle the data how you see fit. e.g

```js
const issue = await jiraHelper.jiraFetch(urlPath);
```
