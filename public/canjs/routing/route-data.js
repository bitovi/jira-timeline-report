import {ObservableObject, value} from "../../can";

import { DAY_IN_MS } from "../../utils/date/date-helpers.js";

import {
    rawIssuesRequestData,
    configurationPromise,
    derivedIssuesRequestData,
    serverInfoPromise,
  } from "../controls/timeline-configuration/state-helpers.js";


import {
saveJSONToUrl,
updateUrlParam,
makeArrayOfStringsQueryParamValue,
} from "./state-storage.js";


import {
    getAllTeamData,
    createFullyInheritedConfig,
  } from "../../react/Configure/components/Teams/services/team-configuration";

import { createNormalizeConfiguration } from "../../react/Configure/components/Teams/shared/normalize";

import { getSimplifiedIssueHierarchy } from "../../stateful-data/jira-data-requests.js";

const _15DAYS_IN_S = DAY_IN_MS / 1000 * 15;

const booleanParsing = {
    parse: (x) => {
      return { "": true, true: true, false: false }[x];
    },
    stringify: (x) => "" + x,
};

class RouteData extends ObservableObject {
    static props = {

        // passed values
        jiraHelpers: null,
        isLoggedInObservable: null,

        // static requests
        jiraFieldsPromise: {
            get default(){
                return this.jiraHelpers.fetchJiraFields()
            }
        },

        

        get allTeamDataPromise(){
            return getAllTeamData(this.storage)
        },
        get simplifiedIssueHierarchyPromise(){
            return getSimplifiedIssueHierarchy( { jiraHelpers: this.jiraHelpers, isLoggedIn: this.isLoggedInObservable.value })
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
        statusesToExclude: makeArrayOfStringsQueryParamValue("statusesToExclude"),

        compareTo: saveJSONToUrl("compareTo", _15DAYS_IN_S, Number, {
            parse(string){
                if(/^\d+$/.test(string)) {
                    return Number(string);
                } 
                else {
                    return _15DAYS_IN_S;
                }
            },
            stringify(number){
                return ""+number;
            }
        }),


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
        get baseNormalizeOptionsAndFieldsToRequestPromise(){
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
            }).catch(() => {
                // Could fail because storage hasn't been setup yet
                return {};
            }).then( ({ fields, ...baseNormalizeOptions }) => {
                return {fields, baseNormalizeOptions}
            });
        },
        
        get baseNormalizeOptionsPromise(){
            return this.baseNormalizeOptionsAndFieldsToRequestPromise.then( ({baseNormalizeOptions}) => baseNormalizeOptions);
        },
        get fieldsToRequestPromise(){
            return this.baseNormalizeOptionsAndFieldsToRequestPromise.then( ({fields}) => fields);
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
            value({listenTo, resolve}){
              const resolveValueFromPromise = () => {
                resolve(undefined);
                if(this.derivedIssuesRequestData?.issuesPromise) {
                  this.derivedIssuesRequestData.issuesPromise.then(resolve);
                }
              };
              listenTo("derivedIssuesRequestData", resolveValueFromPromise);
              resolveValueFromPromise();
            }
        }

    }
}

const routeData = new RouteData();
console.log("routeData", routeData);

export default routeData;




function makeAsyncFromObservableButStillSettableProperty(promiseProperty) {
    return {
        value({resolve, listenTo, lastSet}) {

            listenTo(promiseProperty, ({value})=>{
                value.then(resolve);
            });
            if(this[promiseProperty]) {
                this[promiseProperty].then(resolve);
            }
            listenTo(lastSet, (value)=>{
                resolve(value);
            });
        }
    }
}