import { getHostedRequestHelper } from "./request-helpers/hosted-request-helper.js";
import mainHelper from "./shared/main-helper.js";

export default async function main(environment) {
  return mainHelper({
    environment,
    config: {
      getRequestHelper: getHostedRequestHelper,
      loginDisplayStyle: "initial",
    },
  });
}
