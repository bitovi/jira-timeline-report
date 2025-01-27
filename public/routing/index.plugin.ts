import type { LinkBuilderFactory, RoutingConfiguration } from "./common";
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

export const createPluginLinkBuilder: LinkBuilderFactory = (appKey?: string) => {
  return (queryParams: string) => {
    if (!appKey) {
      throw new Error("App key is required for plugin links");
    }

    if (!AP) {
      throw new Error("AP must be defined in the plugin");
    }

    const queryParamsObject = queryStringToObject(queryParams);

    const [baseUrl, containerSearch] = AP?.history.getState("all").href.split("?");

    // In order to deep link into a jira application, we need to prefix the params with ac.${appKey}.${key}
    // since we are linking outside the iframe jira originally loaded us into.
    const prefixedParams = Object.fromEntries(
      Object.entries(queryParamsObject).map(([key, value]) => [`ac.${appKey}.${key}`, value])
    );

    const currentParams = new URLSearchParams(containerSearch);

    // Jira adds these params when you load a jira application
    const projectId = currentParams.get("project.id");
    const projectKey = currentParams.get("project.key");

    if (!projectId) {
      throw new Error("could not find projectId");
    }

    if (!projectKey) {
      throw new Error("could not find projectKey");
    }

    prefixedParams["project.id"] = projectId;
    prefixedParams["project.key"] = projectKey;

    console.log({
      queryParams,
      queryParamsObject,
      prefixedParams,
      prefixedString: objectToQueryString(prefixedParams),
    });

    return baseUrl + "?" + objectToQueryString(prefixedParams);
  };
};
