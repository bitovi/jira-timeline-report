import mainHelper from "./shared/main-helper.js";
import { createJiraPluginStorage } from "./jira/storage/index.plugin";
import routing from "./routing/index.plugin";
import { createPluginLinkBuilder } from "./routing/index.plugin";

export default async function main() {
  return mainHelper(
    {
      JIRA_CLIENT_ID: import.meta.env.VITE_JIRA_CLIENT_ID,
      JIRA_SCOPE: import.meta.env.VITE_JIRA_SCOPE,
      JIRA_CALLBACK_URL: import.meta.env.VITE_JIRA_CALLBACK_URL,
      JIRA_API_URL: import.meta.env.VITE_JIRA_API_URL,
      JIRA_APP_KEY: import.meta.env.VITE_JIRA_APP_KEY,
      COMMIT_SHA: import.meta.env.VITE_COMMIT_SHA,
    },
    {
      host: "jira",
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
    }
  );
}

main();
