import type { RoutingConfiguration } from "./common";
import { objectToQueryString, queryStringToObject } from "./utils";

const routingConfig: RoutingConfiguration = {
  reconcileRoutingState: () => {
    const jiraRoutingQueryParams = AP?.history.getState("all")?.query ?? {};

    history.replaceState(null, "", "?" + objectToQueryString(jiraRoutingQueryParams));
  },
  syncRouters: () => {
    const originalPushState = history.pushState;

    history.pushState = function (...args) {
      originalPushState.apply(this, args);

      AP?.history.replaceState({
        query: queryStringToObject(window.location.search),
        state: { fromPopState: "false" },
      });
    };
  },
};

export default routingConfig;
