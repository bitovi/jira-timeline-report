import { getConnectRequestHelper } from "./request-helpers/connect-request-helper.js";
import mainHelper from "./shared/main-helper.js";

export default async function main(environment) {
  const loginComponent = await mainHelper({
    environment,
    config: {
      getRequestHelper: getConnectRequestHelper,
      loginDisplayStyle: "none",
    },
  });

  loginComponent.isLoggedIn = true;

  return loginComponent;
}
