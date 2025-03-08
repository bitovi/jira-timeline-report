import { ObservableObject, value, diff } from "../../../can.js";

import { DAY_IN_MS } from "../../../utils/date/date-helpers.js";
import { daysBetween } from "../../../utils/date/days-between.js";
import { isoToLocalDate } from "../../../utils/date/local.js";

import { allStatusesSorted } from "../../../jira/normalized/normalize.ts";

import {
  rawIssuesRequestData,
  configurationPromise,
  derivedIssuesRequestData,
  serverInfoPromise,
} from "../../controls/timeline-configuration/state-helpers.js";

import {
  saveJSONToUrl,
  updateUrlParam,
  makeArrayOfStringsQueryParamValueButAlsoLookAtReportData,
  pushStateObservable,
  saveJSONToUrlButAlsoLookAtReportData,
  makeParamAndReportDataReducer,
  listenToReportDataChanged,
  listenToUrlChange,
  paramValue
  // saveJSONToUrlButAlsoLookAtReportData2
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
import { getTimingLevels } from "../../../utils/timing/helpers";
import { getAllReports } from "../../../jira/reports/fetcher";
import { reportKeys } from "../../../react/services/reports";
import { queryClient } from "../../../react/services/query/queryClient";

const _15DAYS_IN_S = (DAY_IN_MS / 1000) * 15;

const booleanParsing = {
  parse: (x) => {
    return { "": true, true: true, false: false }[x];
  },
  stringify: (x) => "" + x,
};

export const REPORTS = [
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
];

export class RouteData extends ObservableObject {
  static props = {
    // passed values
    jiraHelpers: {
      enumerable: false,
      default: null
    },
    isLoggedInObservable: {
      enumerable: false,
      default: null
    },
    storage: {
      enumerable: false,
      default: null
    },

    // static requests
    jiraFieldsPromise: {
      get default() {
        return this.jiraHelpers.fetchJiraFields();
      },
      enumerable: false
    },
    report: saveJSONToUrl("report", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    reportsData: {
      type: Object,
      set(value) {
        console.log("Got new reports data", value);
        return value;
      },
      enumerable: false
    },
    get reportData() {
      if(this.report && this.reportsData) {
        return this.reportsData[this.report];
      }
    },
    get allTeamDataPromise() {
      return getAllTeamData(this.storage);
    },
    get simplifiedIssueHierarchyPromise() {
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
      if (!this.simplifiedIssueHierarchy || !this.timingCalculations) {
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
    showSettings: saveJSONToUrlButAlsoLookAtReportData("settings", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    jql: saveJSONToUrlButAlsoLookAtReportData("jql", "", String, { parse: (x) => "" + x, stringify: (x) => "" + x }),
    loadChildren: saveJSONToUrlButAlsoLookAtReportData("loadChildren", false, Boolean, booleanParsing),
    childJQL: saveJSONToUrlButAlsoLookAtReportData("childJQL", "", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),

    roundTo: saveJSONToUrlButAlsoLookAtReportData("roundTo", "day", String, {
      parse: function (x) {
        if (ROUND_OPTIONS.find((key) => key === x)) {
          return x;
        } else {
          return "day";
        }
      },
      stringify: (x) => "" + x,
    }),

    statusesToExclude: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData("statusesToExclude"),

    // this is always in seconds
    compareTo: saveJSONToUrlButAlsoLookAtReportData("compareTo", _15DAYS_IN_S, undefined, {
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
        .catch((e) => {
          // Could fail because storage hasn't been setup yet
          console.warn("could not have team data", e);
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
    baseNormalizeOptions: {
      async() {
        return this.baseNormalizeOptionsPromise;
      },
    },
    get fieldsToRequestPromise() {
      return this.baseNormalizeOptionsAndFieldsToRequestPromise.then(({ fields }) => fields);
    },
    get normalizeOptionsPromise() {
      return configurationPromise({
        serverInfoPromise: this.serverInfoPromise,
        normalizeObservable: value.from(this, "baseNormalizeOptions"),
      });
    },

    // THESE are settable by react
    fieldsToRequest: makeAsyncFromObservableButStillSettableProperty("fieldsToRequestPromise"),

    // This can get set, but needs some base loaded normalize option
    normalizeOptions: makeAsyncFromObservableButStillSettableProperty("normalizeOptionsPromise"),

    derivedIssuesRequestData: {
      value({ listenTo, resolve }) {
        return derivedIssuesRequestData(
          {
            rawIssuesRequestData: value.from(this, "rawIssuesRequestData"),
            configurationPromise: value.from(this, "normalizeOptions"),
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
    get allStatusesSorted() {
      if (this.derivedIssues) {
        return allStatusesSorted(this.derivedIssues);
      } else {
        return [];
      }
    },
    timingCalculations: makeParamAndReportDataReducer({
      key: "timingCalculations",
      parse(value){
        let phrases = value.split(",");
        const data = {};
        for (let phrase of phrases) {
          const parts = phrase.split(":");
          data[parts[0]] = parts[1];
        }
        return data;
      },
      stringify(obj) {
        return Object.keys(obj || {})
            .map((key) => key + ":" + obj[key])
            .join(",");
      },
      checkIfChanged(newValue, currentValue) {
        if(!Array.isArray(currentValue)) {
          return true;
        } else if (diff.map(newValue, currentValue).length) {
          return true;
        }
      }
    }),
    
    /*{
      enumerable: true,
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
    },*/
    /*
    timingCalculations: {
      value({ resolve, lastSet, listenTo }) {
        // handle determining the value from sources
        let state = {
          reportData: {loading: false, value: undefined},
          urlValue: undefined
        };

        listenTo("reportDataPromise",({value})=> reportDataPromiseChanged(value));
        reportDataPromiseChanged(this.reportDataPromise);
        function reportDataPromiseChanged(value){
          if(!value) {
            resolveValueFromState(state, "reportData", {loading: false, value: undefined, resolved: false, rejected: false, hasReport: false})
          } else {
            resolveValueFromState(state, "reportData", {loading: true, value: undefined, resolved: false, rejected: false, hasReport: true});
            value.then((reportData) => {
              let paramValue = new URLSearchParams(reportData.queryParams).get("timingCalculations")
              resolveValueFromState(state, "reportData", {loading: false, value: paramValue, resolved: true, rejected: false, hasReport: true})
            }, function(){
              // we are ignoring
              resolveValueFromState(state, "reportData", {loading: false, value: undefined, resolved: false, rejected: true, hasReport: false})
            })
          }
        }

        listenTo(pushStateObservable, routeChanged);
        routeChanged();
        function routeChanged() {
          resolveValueFromState(state, "urlValue", new URL(window.location).searchParams.get("timingCalculations"));
        }

        function _resolveValueFromState(state, event, data){
          const newState = {
            ...state,
            [event]: data
          }
          // while loading, do nothing, keep as undefined
          if(newState.reportData.loading) {
            resolve(undefined);
            return newState;
          } 
          if(event === "reportData") {
            if(!newState.reportData.hasReport) {
              resolve(extract(newState.reportData.urlValue));
            } else if(newState.reportData.resolved) {
              // if there is nothing in the URL, but we have a value in report data, use it
              if(newState.reportData.value && !state.urlValue) {
                resolve(extract(newState.reportData.value))
              } 
              // use the URL value
              else {
                resolve(extract(newState.reportData.urlValue))
              }
              
            }
            return newState;
          }
          else if(event === "urlValue") {
            return resolve(extract(newState.reportData.urlValue))
          }
        }
        function resolveValueFromState() {
          state = _resolveValueFromState.apply(this, arguments);
        }

        // handle setting a new value ... don't worry about a report set at the exact same time
        listenTo(lastSet, (value) => {
          updateUrlParam("timingCalculations", stringify(value), stringify([]));
        });

        function parse(value) {
          let phrases = value.split(",");
          const data = {};
          for (let phrase of phrases) {
            const parts = phrase.split(":");
            data[parts[0]] = parts[1];
          }
          return data;
        }

        function extract(paramValue){
          let value;
          if (typeof paramValue === "string") {
            try {
              value = parse(paramValue);
            } catch (e) {
              value = [];
            }
          } else if (!value) {
            value = [];
          }
          return value;
        }
        function stringify(obj) {
          return Object.keys(obj)
            .map((key) => key + ":" + obj[key])
            .join(",");
        }
      },
    },*/
    primaryReportType: saveJSONToUrlButAlsoLookAtReportData("primaryReportType", "start-due", String, {
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
      enumerable: false
    },

    get issueHierarchy() {
      return this.derivedIssues && this.derivedIssues.length
        ? issueHierarchyFromNormalizedIssues(this.derivedIssues)
        : this.simplifiedIssueHierarchy;
    },
    selectedIssueType: {
      enumerable: true,
      value({ resolve, lastSet, listenTo }) {
        let reportDataParam;
        let urlParam;
        let resolveCurrentValue;

        // bind to stuff ... but we don't want to respond to change just yet
        listenToReportDataChanged(this,"selectedIssueType",listenTo, (param)=>{
          reportDataParam = param;
          resolveCurrentValue && resolveCurrentValue();
        })

        listenToUrlChange("selectedIssueType", listenTo, (param) => {
          urlParam = param;
          resolveCurrentValue && resolveCurrentValue();
        });

        listenTo("issueHierarchy", ({ value }) => {
          resolveCurrentValue && resolveCurrentValue();
        });

        function getParamValue(){
          if(urlParam != null) {
            return urlParam;
          }
          else if(reportDataParam != null) {
            return reportDataParam;
          } else {
            return "";
          }
        }

        let timers = [];
        function clearTimers() {
          timers.forEach((value) => clearTimeout(value));
          timers = [];
        }

        // anything happens in state, update the route
        // the route updates, update the state (or the route if it's wrong)
        resolveCurrentValue = () => {
          clearTimers();

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

        listenTo(lastSet, (value) => {
          const param = this.reportData && paramValue(this.reportData, "selectedIssueType");
          updateUrlParam("selectedIssueType", value, param || "");
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

    primaryReportBreakdown: saveJSONToUrlButAlsoLookAtReportData("primaryReportBreakdown", false, Boolean, booleanParsing),
    secondaryReportType: saveJSONToUrlButAlsoLookAtReportData("secondaryReportType", "none", String, {
      parse: (x) => "" + x,
      stringify: (x) => "" + x,
    }),
    // TEST
    showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),
    sortByDueDate: saveJSONToUrlButAlsoLookAtReportData("sortByDueDate", false, Boolean, booleanParsing),
    hideUnknownInitiatives: saveJSONToUrlButAlsoLookAtReportData("hideUnknownInitiatives", false, Boolean, booleanParsing),
    showOnlySemverReleases: saveJSONToUrlButAlsoLookAtReportData("showOnlySemverReleases", false, Boolean, booleanParsing),
    statusesToShow: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData("statusesToShow"),
    statusesToRemove: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData("statusesToRemove"),
    planningStatuses: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData("planningStatuses"),
    releasesToShow: makeArrayOfStringsQueryParamValueButAlsoLookAtReportData("releasesToShow"),

    // GroupBy is not available for release ... so if a release primaryIssueType is set
    // then we need to remove it
    groupBy: makeParamAndReportDataReducer({
      key: "groupBy",
      defaultValue: "",

      parse: (x) => "" + x,
      stringify: (x) => "" + x,

      listeners: {
        primaryIssueType({state, updateUrlParam}, {value}){
          const primaryIssueType = value;
          if (primaryIssueType === "Release") {
            updateUrlParam("", "");
          } else {
            // if it changes to something else .... keep it ... not sure why this is even needed
            updateUrlParam(state.urlParamValue,state.reportParamValue || "");
          }
        }
      }
    })
    
    /*{
      enumerable: true,
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
    },*/
  };
}

const routeData = new RouteData();

export default routeData;
