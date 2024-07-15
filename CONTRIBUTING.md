## Contributing

Clone the application into your local machine and install node modules.

```sh
git clone https://github.com/bitovi/jira-integrations.git
cd jira-integrations
npm i
```

### Getting Environment Variables

The next step is to fill in your environment variables. You can use the .env.example to create your .env in your root folder

```sh
cp .env.example .env
```

Follow the steps below to get remaining environment variables:

- Open Jira developer console. https://developer.atlassian.com/console/myapps/ 
- Create your app and choose OAuth2.0, put in the app name and accept the terms.
- Click Permissions, add the Jira API scope then configure it. Choose the scope "View Jira issue data"... or "read:jira-work" and save.
- Click Authorization, input the callback url, as default for this application locally, use `http://localhost:3000/oauth-callback` and save.
- Click Settings and scroll down to copy your CLIENT_ID and CLIENT_SECRET.
- The CLIENT_JIRA_API_URL is `https://api.atlassian.com`.

Note: All environment variables that start with `CLIENT` will be sent to the client side and exposed.


### Running the project locally

Open the terminal and run

```sh
npm run fe:js:build
```

Open a second terminal and run

```sh
npm run fe:css:build
```


Open a third terminal and run

```sh
npm run start-local
```

Open your browser and navigate to http://localhost:3000/
