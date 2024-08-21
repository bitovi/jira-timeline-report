import { StacheElement, type, ObservableObject, ObservableArray, value } from "../can.js";

import {saveJSONToUrl,updateUrlParam} from "../shared/state-storage.js";
import { calculationKeysToNames, allTimingCalculationOptions, getImpliedTimingCalculations } from "../prepare-issues/date-data.js";

import { rawIssuesRequestData, configurationPromise, derivedIssuesRequestData, serverInfoPromise} from "./state-helpers.js";

import { allStatusesSorted } from "../jira/normalized/normalize.js";

import "../status-filter.js";

const booleanParsing = {
    parse: x => {
      return ({"": true, "true": true, "false": false})[x];
    },
    stringify: x => ""+x
  };


const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"

export class TimelineConfiguration extends StacheElement {
    static view = `
        <p>
            Questions on the options? 
            <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#getting-started">Read the guide</a>, or 
            <a class="link" href="https://github.com/bitovi/jira-timeline-report/tree/main?tab=readme-ov-file#need-help-or-have-questions">connect with us</a>.
        </p>  
        <h3 class="h3">Issue Source</h3>
        <p>Specify a JQL that loads all issues you want to report on and help determine the timeline of your report.</p>
        <p>
            {{# if(this.isLoggedIn) }}
            <input class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'/>
            {{ else }}
            <input class="w-full-border-box mt-2 form-border p-1 text-yellow-300" value="Sample data. Connect to Jira to specify." disabled/>
            {{/ if}}
        </p>
        {{# if(this.rawIssuesRequestData.issuesPromise.isPending) }}
            {{# if(this.rawIssuesRequestData.progressData.issuesRequested)}}
            <p class="text-xs text-right">Loaded {{this.rawIssuesRequestData.progressData.issuesReceived}} of {{this.rawIssuesRequestData.progressData.issuesRequested}} issues</p>
            {{ else }}
            <p class="text-xs text-right">Loading issues ...</p>
            {{/ if}}
        {{/ if }}
        {{# if(this.rawIssuesRequestData.issuesPromise.isRejected) }}
            <div class="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
            <p>There was an error loading from Jira!</p>
            <p>Error message: {{this.rawIssuesRequestData.issuesPromise.reason.errorMessages[0]}}</p>
            <p>Please check your JQL is correct!</p>
            </div>
        {{/ if }}
        <div class="flex justify-between mt-1">

            <p class="text-xs"><input type='checkbox' 
            class='self-start align-middle' checked:bind='this.loadChildren'/> <span class="align-middle">Load all children of JQL specified issues</span>
            </p>
            
            {{# if(this.rawIssuesRequestData.issuesPromise.isResolved) }}
            <p class="text-xs">Loaded {{this.rawIssuesRequestData.issuesPromise.value.length}} issues</p>
            {{/ if }}
        </div>
        

        <h3 class="h3 mt-4">Primary Timeline</h3>
        <div class="flex mt-2 gap-2 flex-wrap">
            {{# if(this.allTimingCalculationOptions) }}
            <p>What Jira artifact do you want to report on?</p>
            <div class="shrink-0">
            {{# for(issueType of this.allTimingCalculationOptions.list) }}
            <label class="px-2"><input 
                type="radio" 
                name="primaryIssueType" 
                checked:from="eq(this.primaryIssueType, issueType.type)"
                on:change="this.primaryIssueType = issueType.type"/> {{issueType.plural}} </label>
            {{/ }}
            </div>
            {{/ if }}
            
            
        </div>

        <div class="flex mt-2 gap-2 flex-wrap">
            <p>What timing data do you want to report?</p>
            <div class="shrink-0">
            <label class="px-2"><input 
                type="radio" 
                name="primaryReportType"
                checked:from="eq(this.primaryReportType, 'start-due')"
                on:change="this.primaryReportType = 'start-due'"
                /> Start and due dates </label>
            <label class="px-2"><input 
                type="radio" 
                name="primaryReportType"
                checked:from="eq(this.primaryReportType, 'due')"
                on:change="this.primaryReportType = 'due'"
                /> Due dates only</label>
            <label class="px-2"><input 
                type="radio" 
                name="primaryReportType"
                checked:from="eq(this.primaryReportType, 'breakdown')"
                on:change="this.primaryReportType = 'breakdown'"
                /> Work breakdown</label>
            </div>
        </div>

        <div class="flex mt-2 gap-2 flex-wrap">
            <p>Do you want to report on completion percentage?</p>
            <input type='checkbox' 
                class='self-start mt-1.5'  checked:bind='this.showPercentComplete'/>
        </div>


        <h3 class="h3">Timing Calculation</h3>
        <div class="grid gap-2 my-2" style="grid-template-columns: auto auto auto;">
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">Parent Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Child Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 3 / span 1; grid-row: 1 / span 1;">How is timing calculated between parent and child?</div>
            <div class="border-b-2 border-neutral-40" style="grid-column: 1 / span 3; grid-row: 1 / span 1;"></div>

            {{# for(timingLevel of this.timingLevels) }}

                <label class="pr-2 py-2 {{ this.paddingClass(scope.index) }}">{{timingLevel.type}}</label>
                {{# eq(timingLevel.types.length, 1) }}
                <span class="p-2">{{timingLevel.types[0].type}}</span>
                {{ else }}
                <select class="${selectStyle}" on:change="this.updateCalculationType(scope.index, scope.element.value)">
                    {{# for(type of timingLevel.types) }}
                    <option {{# if(type.selected) }}selected{{/ if }}>{{type.type}}</option>
                    {{/ for }}
                </select>
                {{/ eq}}

                <select class="${selectStyle}" on:change="this.updateCalculation(scope.index, scope.element.value)">
                {{# for(calculation of timingLevel.calculations) }}
                    <option {{# if(calculation.selected) }}selected{{/ if }} value="{{calculation.calculation}}">{{calculation.name}}</option>
                {{/ for }}
                </select>

            {{/ for }}
            
        </div>
        {{# if(this.primaryIssueType) }}
        <h3 class="h3">Filters</h3>

        <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">

            <label class=''>Hide Unknown {{this.primaryIssueType}}s</label>
            <input type='checkbox' 
            class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>
            <p class="m-0">Hide {{this.primaryIssueType}}s whose timing can't be determined.
            </p>

            <label>{{this.firstIssueTypeWithStatuses}} Statuses to Report</label>
            <status-filter 
                statuses:from="this.statuses"
                param:raw="statusesToShow"
                selectedStatuses:to="this.statusesToShow"
                style="max-width: 400px;">
            </status-filter>
            <p>Only include these statuses in the report</p>

            <label>{{this.firstIssueTypeWithStatuses}} Statuses to Ignore</label>
            <status-filter 
                statuses:from="this.statuses" 
                param:raw="statusesToRemove"
                selectedStatuses:to="this.statusesToRemove"
                style="max-width: 400px;">
                </status-filter>
            <p>Search for statuses to remove from the report</p>

            {{# eq(this.primaryIssueType, "Release") }}
            <label class=''>Show Only Semver Releases</label>
            <input type='checkbox' 
                class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>
            <p class="m-0">This will only include releases that have a structure like <code>[NAME]_[D.D.D]</code>. Examples:
            <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
            </p>
            {{/ }}


        </div>
        {{/ if }}

        <h3 class="h3">Sorting</h3>
        <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">
            <label class=''>Sort by Due Date</label>
            <input type='checkbox' 
                class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>
            <p class="m-0">Instead of ordering initiatives based on the order defined in the JQL, 
            sort initiatives by their last epic's due date.
            </p>
        </div>

        <h3 class="h3">Secondary Status Report</h3>
        <div class="flex mt-2 gap-2 flex-wrap">
            <p>Secondary Report Type</p>
            <div class="shrink-0">
            <label class="px-2"><input 
                type="radio" 
                name="secondary" 
                checked:from="eq(this.secondaryReportType, 'none')"
                on:change="this.secondaryReportType = 'none'"
                /> None </label>
                
            <label class="px-2"><input 
                type="radio" 
                name="secondary" 
                checked:from="eq(this.secondaryReportType, 'status')"
                on:change="this.secondaryReportType = 'status'"
                /> {{this.secondaryIssueType}} status </label>
            
            {{# not(eq(this.secondaryIssueType, "Story") ) }}
            <label class="px-2"><input 
                type="radio" 
                name="secondary" 
                checked:from="eq(this.secondaryReportType, 'breakdown')"
                on:change="this.secondaryReportType = 'breakdown'"
                /> {{this.secondaryIssueType}} work breakdown </label>
            {{/ not }}
            </div>
        </div>
        {{# if(this.firstIssueTypeWithStatuses) }}
        <div class="flex gap-2 mt-1">
            <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>
            <status-filter 
            statuses:from="this.statuses" 
            param:raw="planningStatuses"
            selectedStatuses:to="this.planningStatuses"
            style="max-width: 400px;"></status-filter>
        </div>
        {{/ if}}`;

    static props = {
        // passed

        // "base" values that do not change when other value change
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, {parse: x => ""+x, stringify: x => ""+x}),
        showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),

        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        
        // VALUES DERIVING FROM THE `jql`
        rawIssuesRequestData: {
            value({listenTo, resolve}) {
                return rawIssuesRequestData({
                    jql: value.from(this, "jql"),
                    loadChildren: value.from(this, "loadChildren"),
                    isLoggedIn: value.from(this, "isLoggedIn"),
                    jiraHelpers: this.jiraHelpers
                },{listenTo, resolve});
            }
        },
        get serverInfoPromise(){
            return serverInfoPromise({jiraHelpers: this.jiraHelpers, isLoggedIn: value.from(this, "isLoggedIn")});
        },
        get configurationPromise(){
            return configurationPromise({teamConfigurationPromise: this.teamConfigurationPromise, serverInfoPromise: this.serverInfoPromise})
        },
        configuration: {
            async() {
                return this.configurationPromise
            }
        },
        derivedIssuesRequestData: {
            value({listenTo, resolve}) {
                return derivedIssuesRequestData({
                    rawIssuesRequestData: value.from(this, "rawIssuesRequestData"),
                    configurationPromise: value.from(this, "configurationPromise")
                },{listenTo, resolve});
            }
        },
        get derivedIssuesPromise(){
            return this.derivedIssuesRequestData.issuesPromise
        },
        derivedIssues: {
            async() {
                return this.derivedIssuesRequestData.issuesPromise
            }
        },
        // PROPERTIES DERIVING FROM `derivedIssues`
        get statuses(){
            if(this.derivedIssues) {
                return allStatusesSorted(this.derivedIssues)
            } else {
                return [];
            }
        },


        allTimingCalculationOptions: {
            async(resolve) {
                if(this.derivedIssuesRequestData.issuesPromise) {
                    return this.derivedIssuesRequestData.issuesPromise.then( issues => {
                        return allTimingCalculationOptions(issues);
                    })
                }
            }
        },

        // primary issue type depends on allTimingCalculationOptions
        // but it can also be set itself
        primaryIssueType: {
            value({resolve, lastSet, listenTo}) {
                
                let currentPrimaryIssueType = new URL(window.location).searchParams.get("primaryIssueType");

                listenTo("allTimingCalculationOptions",({value})=> {
                    reconcileCurrentValue(value, currentPrimaryIssueType);
                });

                listenTo(lastSet, (value)=>{
                    setCurrentValue(value);
                });

                //setCurrentValue(new URL(window.location).searchParams.get("primaryIssueType") )

                
                reconcileCurrentValue(this.allTimingCalculationOptions, currentPrimaryIssueType);

                function reconcileCurrentValue(calculationOptions, primaryIssueType){
                    // if we've actually loaded some stuff, but it doesn't match the current primary issue type
                    if(calculationOptions && calculationOptions.list.length > 1) {
                        if( calculationOptions.map[primaryIssueType] ) {
                            // do nothing
                            resolve(primaryIssueType);
                        } else {
                            updateUrlParam("primaryIssueType", "", "");
                            resolve(currentPrimaryIssueType = calculationOptions.list[1].type)
                        }
                        // default to the thing after release
                    } else {
                        // folks can wait on the value until we know we have a valid one
                        resolve(undefined);
                    }
                }

                function setCurrentValue(value) {
                    currentPrimaryIssueType = value;
                    updateUrlParam("primaryIssueType", value, "");
                    // calculationOptions ... need to pick the right one if empty
                    resolve(value)
                }
                
                
  
            }
        },

        // PROPERTIES only needing primaryIssue type and what it depends on

        // looks like [{type: "initiative", calculation: "children-only"}, ...]
        // in the URL like ?timingCalculations=initiative:children-only,epic:self
        timingCalculations: {
            value({resolve, lastSet, listenTo}) {
              let currentValue;
              updateValue(new URL(window.location).searchParams.get("timingCalculations"));
  
              listenTo(lastSet, (value)=>{
                  updateValue(value);
              });

              // reset when primary issue type changes
              listenTo("primaryIssueType",()=>{
                updateValue([]);
              });
  
              function updateValue(value) {
                if(typeof value === "string"){
                  try {
                    value = parse(value);
                  } catch(e) {
                    value = [];
                  }
                } else if(!value){
                  value = [];
                }
                  
                updateUrlParam("timingCalculations", stringify(value), stringify([]));
  
                currentValue = value;
                resolve(currentValue);
              }
  
              function parse(value){
                return value.split(",").map( piece => {
                  const parts = piece.split(":");
                  return {type: parts[0], calculation: parts[1]};
                }).flat()
              }
              function stringify(array){
                return array.map( (obj) => obj.type+":"+obj.calculation).join(",")
              }
  
            }
        },
        get impliedTimingCalculations(){
            if(this.primaryIssueType) {
                return getImpliedTimingCalculations(this.primaryIssueType, 
                    this.allTimingCalculationOptions.map, 
                    this.timingCalculations);
            }
        },

        // PROPERTIES from having a primaryIssueType and timingCalculations
        get firstIssueTypeWithStatuses(){
            if(this.primaryIssueType) {
                if(this.primaryIssueType !== "Release") {
                    return this.primaryIssueType;
                } else {
                    // timing calculations lets folks "skip" from release to some other child
                    const calculations= this.impliedTimingCalculations;
                    if(calculations[0].type !== "Release") {
                        return calculations[0].type;
                    } else {
                        return calculations[1].type;
                    }
                }
            }
        },
        // used to get the name of the secondary issue type
        get secondaryIssueType(){
            if(this.primaryIssueType) {
                const calculations = this.impliedTimingCalculations;
                if(calculations.length) {
                    return calculations[0].type
                }
            }
            
        },

        get timingCalculationMethods() {
            if(this.primaryIssueType) {
                return this.impliedTimingCalculations
                    .map( (calc) => calc.calculation)
            }
        },

        get timingLevels(){
            if(this.primaryIssueType) {
                return getTimingLevels(this.allTimingCalculationOptions.map, this.primaryIssueType, this.timingCalculations);
            }            
        },
        get rollupTimingLevelsAndCalculations(){
            if(this.impliedTimingCalculations) {
                const impliedCalculations = this.impliedTimingCalculations;
                const primaryIssueType = this.primaryIssueType;
                const primaryIssueHierarchy = this.allTimingCalculationOptions.map[this.primaryIssueType].hierarchyLevel;
                const rollupCalculations = [];
                for( let i = 0; i < impliedCalculations.length + 1; i++) {
                    rollupCalculations.push({
                        type: i === 0 ? primaryIssueType : impliedCalculations[i-1].type,
                        hierarchyLevel: i === 0 ? primaryIssueHierarchy : impliedCalculations[i-1].hierarchyLevel,
                        calculation: i >= impliedCalculations.length  ? "parentOnly" : impliedCalculations[i].calculation
                    })
                }
                return rollupCalculations;
            }
        },
        // dependent on primary issue type
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),

        
        // STATUS FILTERING STUFF
        
        planningStatuses: {
          get default(){
            return [];
          }
        },
        // used for later filtering
        // but the options come from the issues
        statusesToRemove: {
            get default(){
                return [];
            }
        },
        statusesToShow: {
            get default(){
                return [];
            }
        }
    };
    // HOOKS
    connected(){

    }
    // METHODS
    updateCalculationType(index, value){
    
        const copyCalculations = [
          ...getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations) 
        ].slice(0,index+1);
  
        copyCalculations[index].type = value;
        this.timingCalculations = copyCalculations;
    }
  
    updateCalculation(index, value){
    
        const copyCalculations = [
            ...getImpliedTimingCalculations(this.primaryIssueType, this.allTimingCalculationOptions.map, this.timingCalculations) 
        ].slice(0,index+1);

        copyCalculations[index].calculation = value;
        this.timingCalculations = copyCalculations;
    }


    // UI Helpers
    paddingClass(depth) {
        return "pl-"+(depth * 2);
    }




   
    
    
    

}

// jql => 
//    
//    rawIssues => 
//        typeToIssueType

// timingCalculations 

// firstIssueTypeWithStatuses(primaryIssueType, typeToIssueType, timingCalculations)

// primaryIssueType





customElements.define("timeline-configuration", TimelineConfiguration);

/**
 * @type {{
 *   type: string, 
 *   calculation: string
 * }} TimingCalculation
 */

/**
 * 
 * @param {TimingCalculationsMap} issueTypeMap 
 * @param {string} primaryIssueType 
 * @param {Array<TimingCalculation>} timingCalculations 
 * @returns 
 */
function getTimingLevels(issueTypeMap, primaryIssueType, timingCalculations){

    const primaryType = issueTypeMap[primaryIssueType];

    let currentType = primaryIssueType;
    
    let childrenCalculations = primaryType.timingCalculations;

    const timingLevels = [];
    const setCalculations = [...timingCalculations];
    
    
    while(childrenCalculations.length) {
        // this is the calculation that should be selected for that level
        let setLevelCalculation = setCalculations.shift() || 
        {
            type: childrenCalculations[0].child, 
            calculation: childrenCalculations[0].calculations[0].calculation
        };
        let selected = childrenCalculations.find( calculation => setLevelCalculation.type === calculation.child);

        let timingLevel = {
        type: currentType,
        types: childrenCalculations.map( calculationsForType => {
            return {
            type: calculationsForType.child,
            selected: setLevelCalculation?.type === calculationsForType.child
            }
        } ),
        calculations: selected.calculations.map( (calculation)=> {
            return {
            ...calculation,
            selected: calculation.calculation === setLevelCalculation.calculation
            }
        })
        }
        timingLevels.push(timingLevel);
        currentType = setLevelCalculation.type;
        childrenCalculations = issueTypeMap[setLevelCalculation.type].timingCalculations;
    }
    return timingLevels;
}