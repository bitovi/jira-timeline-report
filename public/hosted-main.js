import mainHelper from "./shared/main-helper.js";
import { createWebAppStorage } from "./jira/storage/index.web";

export default async function main(config) {
  return mainHelper(config, { host: "hosted", createStorage: createWebAppStorage });
}
