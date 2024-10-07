import mainHelper from "./shared/main-helper.js";
import { createWebAppStorage } from "./jira/storage/index.web.js";

export default async function main(config) {
  return mainHelper(config, { host: "hosted", createStorage: createWebAppStorage });
}
