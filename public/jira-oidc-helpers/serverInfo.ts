import { Config, RequestHelperResponse } from "../shared/types";


export const _cachedServerInfoPromise = (config: Config) => () => {
  return config.requestHelper("/api/3/serverInfo");
};

export const getServerInfo = (config: Config) => (): Promise<RequestHelperResponse> => {
  // if(this._cachedServerInfoPromise) {
  // 	return this._cachedServerInfoPromise;
  // }
  // // https://your-domain.atlassian.net/rest/api/3/serverInfo
  // return this._cachedServerInfoPromise( = config.requestHelper('/api/3/serverInfo'));
  return _cachedServerInfoPromise(config)();
};
