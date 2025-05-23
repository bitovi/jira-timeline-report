import mainHelper from './shared/main-helper.js';
import { createJiraPluginStorage } from './jira/storage/index.plugin';
import routing from './routing/index.plugin';
import { createPluginLinkBuilder } from './routing/index.plugin';

interface LicensingInformation {
  active: boolean;
  evaluation: boolean;
}

const defaultLicensing = {
  active: false,
  evaluation: false,
};

const getLicensing = async (appKey: string): Promise<LicensingInformation> => {
  if (appKey.includes('staging') || appKey.includes('local')) {
    // we don't require licensing for staging or local development
    return { active: true, evaluation: true };
  }

  return (
    AP?.request<{ body: string }>('/rest/atlassian-connect/1/addons/' + appKey)
      .then(({ body }) => {
        return (JSON.parse(body) as { license?: LicensingInformation })?.license ?? defaultLicensing;
      })
      .catch((err) => {
        console.error(`Error parsing licensing information`, err);

        return defaultLicensing;
      }) ?? defaultLicensing
  );
};

export default async function main() {
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
      host: 'jira',
      createStorage: createJiraPluginStorage,
      configureRouting: (route: {
        reconcileRoutingState: () => void;
        start: () => void;
        _onStartComplete: unknown;
      }) => {
        routing.reconcileRoutingState();

        route._onStartComplete = routing.syncRouters;
        route.start();
      },
      createLinkBuilder: createPluginLinkBuilder,
      showSidebarBranding: true,
      isAlwaysLoggedIn: true,
      licensingPromise: getLicensing(import.meta.env.VITE_JIRA_APP_KEY),
    },
  );
}

main();
