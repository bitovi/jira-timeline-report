## Jira OAuth Integration

This is a simple Jira oAuth template or starter-pack. It helps bootstrap your Jira application with OAuth2.0 already setup.

## How to Use

### Installation

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
