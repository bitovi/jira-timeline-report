import mainHelper from "./shared/main-helper.js";
import { createJiraPluginStorage } from "./jira/storage/index.plugin";
import routing from "./routing/index.plugin";
import { createPluginLinkBuilder } from "./routing/index.plugin";
export default async function main(config) {
  return mainHelper(config, {
    host: "jira",
    createStorage: createJiraPluginStorage,
    configureRouting: (route) => {
      routing.reconcileRoutingState();

      route._onStartComplete = routing.syncRouters;
      route.start();
    },
    createLinkBuilder: createPluginLinkBuilder,
    showSidebarBranding: true,
    isAlwaysLoggedIn: true,
  });
}
