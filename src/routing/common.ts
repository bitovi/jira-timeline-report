export interface RoutingConfiguration {
  reconcileRoutingState: () => void;
  syncRouters: () => void;
}

interface JiraLocationState {
  key: string;
  hash: string | null;
  query?: {
    state?: string;
  };
  state?: Record<string, string> | null;
  title: string;
  href: string;
}

type HistoryStateType = 'all' | 'hash';

type HistoryStateMap = {
  all: JiraLocationState;
  hash: string;
};

declare global {
  interface AP {
    history: {
      getState: <TStateType extends HistoryStateType>(
        type?: TStateType,
        callback?: (state: JiraLocationState) => void,
      ) => HistoryStateMap[TStateType];
      replaceState: (state: Partial<JiraLocationState>) => void;
      subscribeState: (type: string, callback: (state: JiraLocationState) => void) => void;
    };
  }
}

export type LinkBuilderFactory = (appKey?: string) => (queryParams: string) => string;

export type LinkBuilder = ReturnType<LinkBuilderFactory>;
