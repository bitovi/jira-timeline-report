import { ObservableObject, value } from "../../../can.js";

import { DAY_IN_MS } from "../../../utils/date/date-helpers.js";
import { daysBetween } from "../../../utils/date/days-between.js";
import { isoToLocalDate } from "../../../utils/date/local.js";

import {
  rawIssuesRequestData,
  configurationPromise,
  derivedIssuesRequestData,
  serverInfoPromise,
} from "../../controls/timeline-configuration/state-helpers.js";

import {
  saveJSONToUrl,
  updateUrlParam,
  makeArrayOfStringsQueryParamValue,
  pushStateObservable,
} from "../state-storage.js";

import { roundDate } from "../../../utils/date/round.js";

const ROUND_OPTIONS = ["day", ...Object.keys(roundDate)];

import {
  getAllTeamData,
  createFullyInheritedConfig,
} from "../../../react/SettingsSidebar/components/TeamConfiguration/components/Teams/services/team-configuration/team-configuration";

import { createNormalizeConfiguration } from "../../../react/SettingsSidebar/components/TeamConfiguration/components/Teams/shared/normalize";

import { getSimplifiedIssueHierarchy } from "../../../stateful-data/jira-data-requests.js";
import {
  issueHierarchyFromNormalizedIssues,
  makeAsyncFromObservableButStillSettableProperty,
  toSelectedParts,
} from "../data-utils.js";

export function getTimingLevels(issueHierarchy, timingCalculations) {
  const baseLevels = createBaseLevels(issueHierarchy);

  return baseLevels.map((level, i) => {
    const child = baseLevels[i + 1];
    const isLast = i === baseLevels.length - 1;

    return {
      ...level,
      childType: child ? child.type : null,
      calculations: calculationsForLevel(level, child, timingCalculations[level.type], isLast),
    };
  });
}
const _15DAYS_IN_S = (DAY_IN_MS / 1000) * 15;

const booleanParsing = {
  parse: (x) => {
    return { "": true, true: true, false: false }[x];
  },
  stringify: (x) => "" + x,
};

const REPORTS = [
  {
    key: "start-due",
    name: "Gantt Chart",
  },
  {
    key: "due",
    name: "Scatter Plot",
  },
  {
    key: "table",
    name: "Estimation Table",
  },
  {
    key: "group-grid",
    name: "Group Grid",
  },
];

export class RouteData extends ObservableObject {
  static props = {
    // passed values
    jiraHelpers: null,
    isLoggedInObservable: null,
    storage: null,

    // static requests
    jiraFieldsPromise: {
      get default() {
        return this.jiraHelpers.fetchJiraFields();
      },
    },

    get allTeamDataPromise() {
      return getAllTeamData(this.storage);
    },
    get simplifiedIssueHierarchyPromise() {
      console.log("getSimplifiedIssueHierarchy", this.isLoggedInObservable.value);
      return getSimplifiedIssueHierarchy({
        jiraHelpers: this.jiraHelpers,
        isLoggedIn: this.isLoggedInObservable.value,
      });
    },
    simplifiedIssueHierarchy: {
      async(resolve) {
        return this.simplifiedIssueHierarchyPromise;
      },
    },
    get issueTimingCalculations() {
      if (!this.simplifiedIssueHierarchy) {
        return [];
      } else {
        const allLevels = getTimingLevels(this.simplifiedIssueHierarchy, this.timingCalculations);
        return allLevels.map((level) => {
          return {
            type: level.type,
            hierarchyLevel: level.hierarchyLevel,
            calculation: level.calculations.find((level) => level.selected).calculation,
          };
        });
      }
    },

    // PURE ROUTES
    showSettings: saveJSONToUrl("settings", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    jql: saveJSONToUrl("jql", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),
    loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
    childJQL: saveJSONToUrl("childJQL", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),

    roundTo: saveJSONToUrl("roundTo", "day", String, {
      parse: function (x) {
        if (ROUND_OPTIONS.find((key) => key === x)) {
          return x;
        } else {
          return "day";
        }
      },
      stringify: (x) => "" + x,
    }),

    statusesToExclude: makeArrayOfStringsQueryParamValue("statusesToExclude"),

    // this is always in seconds
    compareTo: saveJSONToUrl("compareTo", _15DAYS_IN_S, undefined, {
      parse(string) {
        const parsedAsDate = isoToLocalDate(string);
        if (/^\d+$/.test(string)) {
          return Number(string);
        } else if (!isNaN(parsedAsDate)) {
          // parsedAsDate is 2025-01-18 to a UTC "date"
          // want to know how many days that was in the past compare to someone's timeframe right now
          return (daysBetween(new Date(), parsedAsDate) * DAY_IN_MS) / 1000;
        } else {
          return _15DAYS_IN_S;
        }
      },
      stringify(number) {
        // assume the date is in UTC?
        if (number instanceof Date) {
          return date.toISOString().split("T")[0];
        }
        return "" + number;
      },
    }),
    // returns "seconds" or "date"
    // duplicates some code above. We should refactor at some point
    get compareToType() {
      // just for the side effects:
      pushStateObservable.value;
      // we probably should make the pushstate observable go into new URL()
      const string = new URL(window.location).searchParams.get("compareTo") || "";
      const parsedAsDate = isoToLocalDate(string);
      if (/^\d+$/.test(string)) {
        return "seconds";
      } else if (!isNaN(parsedAsDate)) {
        return "date";
      } else {
        return "seconds";
      }
    },

    // DERIVED
    rawIssuesRequestData: {
      value({ listenTo, resolve }) {
        return rawIssuesRequestData(
          {
            jql: value.from(this, "jql"),
            childJQL: value.from(this, "childJQL"),
            loadChildren: value.from(this, "loadChildren"),
            isLoggedIn: this.isLoggedInObservable,
            jiraHelpers: this.jiraHelpers,
            fields: value.from(this, "fieldsToRequest"),
          },
          { listenTo, resolve }
        );
      },
    },
    get serverInfoPromise() {
      return serverInfoPromise({
        jiraHelpers: this.jiraHelpers,
        isLoggedIn: this.isLoggedInObservable,
      });
    },
    // normalize options without the server info
    get baseNormalizeOptionsAndFieldsToRequestPromise() {
      return Promise.all([
        this.jiraFieldsPromise,
        this.allTeamDataPromise,
        this.simplifiedIssueHierarchyPromise,
      ])
        .then(([jiraFields, teamData, hierarchyLevels]) => {
          const allTeamData = createFullyInheritedConfig(
            teamData,
            jiraFields,
            hierarchyLevels.map((type) => type.hierarchyLevel.toString())
          );
          return allTeamData;
        })
        .then((allTeamData) => {
          const normalizedConfig = createNormalizeConfiguration(allTeamData);
          return normalizedConfig;
        })
        .catch(() => {
          // Could fail because storage hasn't been setup yet
          return {};
        })
        .then(({ fields, ...baseNormalizeOptions }) => {
          return { fields, baseNormalizeOptions };
        });
    },

    get baseNormalizeOptionsPromise() {
      return this.baseNormalizeOptionsAndFieldsToRequestPromise.then(
        ({ baseNormalizeOptions }) => baseNormalizeOptions
      );
    },
    get fieldsToRequestPromise() {
      return this.baseNormalizeOptionsAndFieldsToRequestPromise.then(({ fields }) => fields);
    },
    get normalizeOptionsPromise() {
      return configurationPromise({
        serverInfoPromise: this.serverInfoPromise,
        normalizeObservable: value.from(this, "baseNormalizeOptionsPromise"),
      });
    },

    // THESE are settable by react
    fieldsToRequest: makeAsyncFromObservableButStillSettableProperty("fieldsToRequestPromise"),
    normalizeOptions: makeAsyncFromObservableButStillSettableProperty("normalizeOptionsPromise"),
    derivedIssuesRequestData: {
      value({ listenTo, resolve }) {
        return derivedIssuesRequestData(
          {
            rawIssuesRequestData: value.from(this, "rawIssuesRequestData"),
            configurationPromise: value.from(this, "normalizeOptionsPromise"),
          },
          { listenTo, resolve }
        );
      },
    },
    get derivedIssuesPromise() {
      return this.derivedIssuesRequestData.issuesPromise;
    },
    derivedIssues: {
      // this can't use async b/c we need the value to turn to undefined
      value({ listenTo, resolve }) {
        const resolveValueFromPromise = () => {
          resolve(undefined);
          if (this.derivedIssuesRequestData?.issuesPromise) {
            this.derivedIssuesRequestData.issuesPromise.then(resolve);
          }
        };
        listenTo("derivedIssuesRequestData", resolveValueFromPromise);
        resolveValueFromPromise();
      },
    },
    timingCalculations: {
      value({ resolve, lastSet, listenTo }) {
        let currentValue;
        updateValue(new URL(window.location).searchParams.get("timingCalculations"));

        listenTo(lastSet, (value) => {
          updateValue(value);
        });

        function updateValue(value) {
          if (typeof value === "string") {
            try {
              value = parse(value);
            } catch (e) {
              value = [];
            }
          } else if (!value) {
            value = [];
          }

          updateUrlParam("timingCalculations", stringify(value), stringify([]));

          currentValue = value;
          resolve(currentValue);
        }

        function parse(value) {
          let phrases = value.split(",");
          const data = {};
          for (let phrase of phrases) {
            const parts = phrase.split(":");
            data[parts[0]] = parts[1];
          }
          return data;
        }
        function stringify(obj) {
          return Object.keys(obj)
            .map((key) => key + ":" + obj[key])
            .join(",");
        }
      },
    },
    primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, {
      parse: function (x) {
        if (REPORTS.find((report) => report.key === x)) {
          return x;
        } else {
          return "start-due";
        }
      },
      stringify: (x) => "" + x,
    }),
    reports: {
      get default() {
        return REPORTS;
      },
    },

    get issueHierarchy() {
      return this.derivedIssues && this.derivedIssues.length
        ? issueHierarchyFromNormalizedIssues(this.derivedIssues)
        : this.simplifiedIssueHierarchy;
    },
    selectedIssueType: {
      value({ resolve, lastSet, listenTo }) {
        function getParamValue() {
          return new URL(window.location).searchParams.get("selectedIssueType") || "";
        }
        let timers = [];
        function clearTimers() {
          timers.forEach((value) => clearTimeout(value));
          timers = [];
        }

        // anything happens in state, update the route
        // the route updates, update the state (or the route if it's wrong)
        const resolveCurrentValue = () => {
          clearTimers();
          const curParamValue = getParamValue();

          // we wait to resolve to a defined value until we can check it's right
          if (this.issueHierarchy && this.issueHierarchy.length) {
            const curParamValue = getParamValue();

            // helps with legacy support to pick the first type
            if (curParamValue === "Release") {
              resolve("Release-" + this.issueHierarchy[0].name);
            } else {
              const curSelectedParts = toSelectedParts(curParamValue);
              //const lastSelectedParts = toSelectedParts(lastSelectedValue);

              if (curSelectedParts) {
                // check it's ok
                let typeToCheck = curSelectedParts.secondary ?? curSelectedParts.primary;

                if (this.issueHierarchy.some((issue) => issue.name === typeToCheck)) {
                  // make sure we actually need to update
                  resolve(curParamValue);
                }
                // set back to default
                else {
                  timers.push(
                    setTimeout(() => {
                      updateUrlParam("selectedIssueType", "", "");
                    }, 20)
                  );
                }
              } else {
                // default to the first type
                resolve(this.issueHierarchy[0].name);
              }
            }
          } else {
            resolve(undefined);
          }
        };

        // when the route changes, check stuff ...
        listenTo(pushStateObservable, () => {
          resolveCurrentValue();
        });

        listenTo("issueHierarchy", ({ value }) => {
          resolveCurrentValue();
        });

        listenTo(lastSet, (value) => {
          console.log("LAST SET sit", value);
          updateUrlParam("selectedIssueType", value, "");
        });

        resolveCurrentValue();
      },
    },
    get primaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).primary;
    },
    get secondaryIssueType() {
      return this.selectedIssueType && toSelectedParts(this.selectedIssueType).secondary;
    },

    primaryReportBreakdown: saveJSONToUrl("primaryReportBreakdown", false, Boolean, booleanParsing),
    secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),
    sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
    hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
    showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
    statusesToShow: makeArrayOfStringsQueryParamValue("statusesToShow"),
    statusesToRemove: makeArrayOfStringsQueryParamValue("statusesToRemove"),
    planningStatuses: makeArrayOfStringsQueryParamValue("planningStatuses"),
    groupBy: {
      value({ resolve, lastSet, listenTo }) {
        function getFromParam() {
          return new URL(window.location).searchParams.get("groupBy") || "";
        }

        const reconcileCurrentValue = (primaryIssueType, currentGroupBy) => {
          if (primaryIssueType === "Release") {
            updateUrlParam("groupBy", "", "");
          } else {
            updateUrlParam("groupBy", currentGroupBy, "");
          }
        };

        listenTo("primaryIssueType", ({ value }) => {
          reconcileCurrentValue(value, getFromParam());
        });

        listenTo(lastSet, (value) => {
          updateUrlParam("groupBy", value || "", "");
        });

        listenTo(pushStateObservable, () => {
          resolve(getFromParam());
        });

        resolve(getFromParam());
      },
    },
  };
}

const routeData = new RouteData();
console.log("routeData", routeData);

export default routeData;
