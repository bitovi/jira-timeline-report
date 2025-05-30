import mainHelper from './shared/main-helper.js';
import { createWebAppStorage } from './jira/storage/index.web';
import { createWebLinkBuilder } from './routing/index.web';

async function main() {
  return mainHelper(
    {
      JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
      JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
      JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
      JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
      JIRA_APP_KEY: import.meta.env.VITE_JIRA_APP_KEY,
      COMMIT_SHA: import.meta.env.VITE_COMMIT_SHA,
      STATUS_REPORTS_ENV: import.meta.env.VITE_STATUS_REPORTS_ENV,
      FRONTEND_SENTRY_DSN: import.meta.env.VITE_FRONTEND_SENTRY_DSN,
    },
    {
      host: 'hosted',
      createStorage: createWebAppStorage,
      configureRouting: (route: { start: () => void }) => {
        route.start();
      },
      createLinkBuilder: createWebLinkBuilder,
      showSidebarBranding: false,
      isAlwaysLoggedIn: false,
      licensingPromise: Promise.resolve({
        active: true,
        evaluation: false,
      }),
    },
  );
}

main();
