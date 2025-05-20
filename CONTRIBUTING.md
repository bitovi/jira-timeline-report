## Contributing

Clone the application into your local machine and install node modules.

Supported node/npm versions are:

```sh
node -v # v22.9.0
```

```sh
npm -v # 10.8.3
```

```sh
git clone https://github.com/bitovi/jira-timeline-report.git
cd jira-timeline-report
npm i
```

### Getting Environment Variables

The next step is to fill in your environment variables. You can use the `.env.example` to create your `.env` in your root folder

```sh
cp .env.example .env
```

Follow the steps below to get remaining environment variables:

- Open Jira developer console. https://developer.atlassian.com/console/myapps/
- Create your app and choose `OAuth 2.0 integration`, put in the app name `status-report-local` and accept the terms.
- Click the Permissions tab in the left sidenav, add the Jira API scope then configure it to the following scopes:
   - `read:jira-work`
   - `write:jira-work`
- Do the same for Confluence API scope. You will have to select `Granular` scopes:
   - `read:app-data:confluence`
   - `write:app-data:confluence`
- Click the Authorization tab in the left sidenav, input the callback url, as default for this application locally, use `http://localhost:5173/oauth-callback` and save.
- Click the Settings tab in the left sidenav and scroll down to copy your `CLIENT_ID` to `VITE_JIRA_CLIENT_ID` and `CLIENT_SECRET` to `JIRA_CLIENT_SECRET` in the `.env` file.
- Click the Distribution tab in the left sidenav. Update Distribution Status to `Sharing`, add the vender name `Bitovi`, and add the Privacy Policy url, `https://bitovi.atlassian.net/wiki/spaces/StatusReportsForJira/pages/1273528366/Privacy+Policy`.

> Note: All environment variables that start with `VITE` will be sent to the client side and exposed.

### Running the project locally

Open the terminal and run

```sh
npm run dev
```

Open your browser and navigate to http://localhost:5173

### Developing Locally in Jira

The Status Reports is a Jira Application that also works as a standalone web app. The following steps will allow you to deploy your app to Jira through Atlassian Connect.

1. [Create an Atlassian dev
   environment](https://developer.atlassian.com/cloud/jira/platform/getting-started-with-connect/#step-2--get-a-cloud-development-site)
   where you will upload the application for testing.
1. [Enable development
   mode](https://developer.atlassian.com/cloud/jira/platform/getting-started-with-connect/#step-3--enable-development-mode-in-your-site)
   so you can upload an application directly.
1. Follow the Atlassian instructions to [Prepare for
   tunneling](https://developer.atlassian.com/cloud/jira/platform/getting-started-with-connect/#step-1--prepare-for-tunneling)
   where you create an ngrok account and copy your Authtoken.
1. Open a fourth terminal and set up the ngrok environment.

```sh
npm install -g ngrok
ngrok authtoken <Authtoken>
```

The following steps are repeatable as many times as needed to re-deploy and re-tunnel your local app.

1. Start ngrok and point it to the local service port

```sh
ngrok http 5173
```

2. After the tunnel starts, you need to create the `atlassian-connect.json` file by running the following command, replacing`--name` with your name and `--url` with the fully qualified url from ngrok.

```sh
npm run create:atlassian-connect -- --environment=local --name=<your-name-here> --url=<fully-qualified-ngrok-url>
```

3. Add a `VITE_JIRA_APP_KEY` environment variable and set it equal to the `key` in the newly created `atlassian-connect.json` file.
   - ex: `VITE_JIRA_APP_KEY=bitovi.timeline-report.local.david`
4. Open your Jira dev environment and click Apps from the top nav, then `Manage Your Apps`. If you have enabled development mode, you should see an `Upload app` option next to `Build a new app`. Click `Upload app`.
5. Paste the secure domain into the text box, and add `/atlassian-connect.json` to the end (e.g. `https://46f7-8-47-99-200.ngrok-free.app/atlassian-connect.json`). Click `Upload`.
6. The apps list should refresh and show `Status Reports (Local <Your Name>)` as a User-installed app. From here, click `Apps` in the top nav and you should see a `Your Apps` heading with `Status Reports (Local <Your Name>)` as an option underneath. Click `Status Reports (Local <Your Name>)` and you should see the Status Reports app load in the window!

## Dev Notes

### Navigating the Files

- The server folder contains a `server.js` which bootstraps an express application that handles auth at `http://localhost:3000`
- The application in dev mode is server at `http://localhost:5173`and the entry point is `index.html`
- All application logic lives in `/src`
- The `dev/`, `oauth-callback/`, `connect/` all contain additional html files that are "secondary pages" when developing
  - `dev/` when deployed is unminified for easy debugging
  - `oauth-callback/` is the redirect url for the application during its auth flow
  - `connect/` is the entry point for the plugin inside of jira
- The `public` folder contains static assets for the project
- The `src/jira-oidc-helpers` is a collection of modules with all the helpers required to interact with Jira and save your access and refresh tokens to `localStorage`.
- You will make changes to the `main-helper.js` files based on your use case. Everything you need to make your request has been layered in `jira-oidc-helpers`.
- Call the `jiraFetch` helper with the url path you want from your main and handle the data how you see fit. e.g

```js
const issue = await jiraHelper.jiraFetch(urlPath);
```

### Additional Docs

[Writing and running E2E Tests](./docs/writing-running-e2e-tests.md)
