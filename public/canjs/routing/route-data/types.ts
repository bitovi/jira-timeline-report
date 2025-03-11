import { ObservableObject } from "../../../can";
import { Jira } from "../../../jira-oidc-helpers";
import { NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import { AppStorage } from "../../../jira/storage/common";
import { RouteData as RouteDataClass } from "./route-data";

type Overrides = {
  showSettings: string;
  storage: AppStorage;
  jiraHelpers: Jira;
  loadChildren: boolean;
  normalizeOptions: Partial<NormalizeIssueConfig>;
  timingCalculations: Record<string, string>;
  childJQL: string;
  jql: string;
  statusesToExclude: string[];
  primaryIssueType: string;
  secondaryIssueType: string;
  groupBy: string;
};

type RouteDataProps = typeof RouteDataClass.props;

export type RouteData = {
  [K in Exclude<keyof RouteDataProps, keyof Overrides>]: RouteDataProps[K];
} & {
  assign: (obj: Partial<RouteData>) => RouteData;
} & ObservableObject &
  Overrides & { serialize: () => Record<string, string> };
