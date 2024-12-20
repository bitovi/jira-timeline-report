import mainHelper from "./shared/main-helper.js";
import { createJiraPluginStorage } from "./jira/storage/index.plugin";
import routing from "./routing/index.plugin";

export default async function main(config) {
  const loginComponent = await mainHelper(config, {
    host: "jira",
    createStorage: createJiraPluginStorage,
    configureRouting: (route) => {
      routing.reconcileRoutingState();

      route._onStartComplete = routing.syncRouters;
      route.start();
    },
    showSidebarBranding: true
  });

  loginComponent.isLoggedIn = true;

  return loginComponent;
}
