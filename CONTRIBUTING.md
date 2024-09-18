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
npm run dev
```

Open your browser and navigate to http://localhost:3000/ to view the minified version of the app.

Navigate to http://localhost:3000/dev to view the unminified version of the app.

### Deploying to Jira

The following setup steps will enable deployment of your app to Jira through Atlassian Connect. These steps should only need to be performed once.

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
ngrok http 3000
```
1. After the tunnel starts, copy the secure domain (e.g. `https://46f7-8-47-99-200.ngrok-free.app`) and
update `baseUrl` in <span style="white-space: nowrap;">public/atlassian-connect.json</span> with the domain.
1. Open your Jira dev environment and click Apps from the top nav, then `Manage Your Apps`.  If you have enabled devlopment mode, you should see an `Upload app` option next to `Build a new app`.  Click `Uplaod app`.
1. Paste the secure domain into the text box, and add `/atlassian-connect.json` to the end (e.g. `https://46f7-8-47-99-200.ngrok-free.app/atlassian-connect.json`).  Click `Upload`.
1. The apps list should refresh and show `Timeline Report` as a User-installed app.  From here, click `Apps` in the top nav and you should see a `Your Apps` heading with `Timeline Report` as an option underneath.  Click `Timeline Report` and you should see the Timeline Report app load in the window!

