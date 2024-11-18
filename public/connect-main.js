import mainHelper from "./shared/main-helper.js";
import { createJiraPluginStorage } from "./jira/storage/index.plugin";

export default async function main(config) {
  const loginComponent = await mainHelper(config, { host: "jira", createStorage: createJiraPluginStorage });

  loginComponent.isLoggedIn = true;

  return loginComponent;
}
