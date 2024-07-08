import { StacheElement, type, ObservableObject, ObservableArray } from "./can.js";

import {saveJSONToUrl,updateUrlParam} from "./shared/state-storage.js";
import { calculationKeysToNames, denormalizedIssueHierarchy, getImpliedTimingCalculations } from "./prepare-issues/date-data.js";

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
            {{# if(this.loginComponent.isLoggedIn) }}
            <input class="w-full-border-box mt-2 form-border p-1" value:bind='this.jql'/>
            {{ else }}
            <input class="w-full-border-box mt-2 form-border p-1 text-yellow-300" value="Sample data. Connect to Jira to specify." disabled/>
            {{/ if}}
        </p>
        {{# if(this.rawIssuesPromise.isPending) }}
            {{# if(this.progressData.issuesRequested)}}
            <p class="text-xs text-right">Loaded {{this.progressData.issuesReceived}} of {{this.progressData.issuesRequested}} issues</p>
            {{ else }}
            <p class="text-xs text-right">Loading issues ...</p>
            {{/ if}}
        {{/ if }}
        {{# if(this.rawIssuesPromise.isRejected) }}
            <div class="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
            <p>There was an error loading from Jira!</p>
            <p>Error message: {{this.rawIssuesPromise.reason.errorMessages[0]}}</p>
            <p>Please check your JQL is correct!</p>
            </div>
        {{/ if }}
        <div class="flex justify-between mt-1">

            <p class="text-xs"><input type='checkbox' 
            class='self-start align-middle' checked:bind='this.loadChildren'/> <span class="align-middle">Load all children of JQL specified issues</span>
            </p>
            
            {{# if(this.rawIssuesPromise.isResolved) }}
            <p class="text-xs">Loaded {{this.rawIssues.length}} issues</p>
            {{/ if }}
        </div>
        

        <h3 class="h3 mt-4">Primary Timeline</h3>
        <div class="flex mt-2 gap-2 flex-wrap">
            <p>What Jira artifact do you want to report on?</p>
            <div class="shrink-0">
            {{# for(issueType of this.primaryReportingIssueHierarchyPromise.value) }}
            <label class="px-2"><input 
                type="radio" 
                name="primaryIssueType" 
                checked:from="eq(this.primaryIssueType, issueType.type)"
                on:change="this.primaryIssueType = issueType.type"/> {{issueType.plural}} </label>
            {{/ }}
            </div>
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


        <h3 class="h3">Timing Calculation</h3>
        <div class="grid gap-2 my-2" style="grid-template-columns: auto auto auto;">
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">Parent Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Child Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 3 / span 1; grid-row: 1 / span 1;">How is timing calculated between parent and child?</div>
            <div class="border-b-2 border-neutral-40" style="grid-column: 1 / span 3; grid-row: 1 / span 1;"></div>

            {{# for(timingLevel of this.timingLevelsPromise.value) }}

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

        <h3 class="h3">Filters</h3>

        <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">

            <label class=''>Hide Unknown {{this.primaryIssueType}}s</label>
            <input type='checkbox' 
            class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/>
            <p class="m-0">Hide {{this.primaryIssueType}}s whose timing can't be determined.
            </p>

            <label>{{this.firstIssueTypeWithStatusesPromise.value}} Statuses to Report</label>
            <status-filter 
                statuses:from="this.statuses"
                param:raw="statusesToShow"
                selectedStatuses:to="this.statusesToShow"
                style="max-width: 400px;">
            </status-filter>
            <p>Only include these statuses in the report</p>

            <label>{{this.firstIssueTypeWithStatusesPromise.value}} Statuses to Ignore</label>
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
                /> {{this.secondaryIssueTypePromise.value}} status </label>
            
            {{# not(eq(this.secondaryIssueTypePromise.value, "Story") ) }}
            <label class="px-2"><input 
                type="radio" 
                name="secondary" 
                checked:from="eq(this.secondaryReportType, 'breakdown')"
                on:change="this.secondaryReportType = 'breakdown'"
                /> {{this.secondaryIssueTypePromise.value}} work breakdown </label>
            {{/ not }}
            </div>
        </div>
        <div class="flex gap-2 mt-1">
            <label>{{this.firstIssueTypeWithStatusesPromise.value}} statuses to show as planning:</label>
            <status-filter 
            statuses:from="this.statuses" 
            param:raw="planningStatuses"
            selectedStatuses:to="this.planningStatuses"
            style="max-width: 400px;"></status-filter>
        </div>`;

    static props = {
        progressData: type.Any,
        loadChildren: saveJSONToUrl("loadChildren", false, Boolean, booleanParsing),
        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryIssueType: saveJSONToUrl("primaryIssueType", "Epic", String, {parse: x => ""+x, stringify: x => ""+x}),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {parse: x => ""+x, stringify: x => ""+x}),
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, {parse: x => ""+x, stringify: x => ""+x}),
        
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
        },
        // looks like [{type: "initiative", calculation: "children-only"}, ...]
        // in the URL like ?timingCalculations=initiative:children-only,epic:self
        timingCalculations: {
            value({resolve, lastSet, listenTo}) {
              let currentValue;
              updateValue(new URL(window.location).searchParams.get("timingCalculations"));
  
              listenTo(lastSet, (value)=>{
                  updateValue(value);
              });
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
          timingCalculationMethods: {
            async(resolve) {
                const primaryIssueType = this.primaryIssueType,
                    timingCalculations = this.timingCalculations;
                if(this.issueHierarchyPromise) {
                    this.issueHierarchyPromise.then( (issueHierarchyPromise)=> {
                        const value = getImpliedTimingCalculations(
                            this.primaryIssueType, 
                            this.issueHierarchy.typeToIssueType, 
                            this.timingCalculations).map( (calc) => calc.calculation);
                        resolve(value);
                    })
                }

                
                const updateValue = () => {
                    if(this.issueHierarchyPromise) {
                        this.issueHierarchyPromise
                    }
                    
                }
            }
          }
    };
    get issueHierarchyPromise(){
        if(this.rawIssuesPromise) {
            this.rawIssuesPromise.then( issues => {
                return denormalizedIssueHierarchy(normalizeAndDeriveIssues(issues));
            })
        }
        
    }
    get statuses(){
        if(!this.rawIssues) {
          return []
        }
        const statuses = new Set();
        for( let issue of this.rawIssues) {
          statuses.add(issue.Status);
        }
        return [...statuses].sort( (s1, s2)=> {
          return s1 > s2 ? 1 : -1;
        });
      }
    get primaryReportingIssueHierarchyPromise(){
        if(this.issueHierarchyPromise) {
            // removes the last item of the issue hierarchy ... this is a "rollup" after all
            return this.issueHierarchyPromise.then( hierarchy => hierarchy.slice(0, -1) );
        }
        

    }
    /*
    get secondaryReportingIssueHierarchy(){
        // hierarchy isn't known at first
        if(!this.issueHierarchy.length) {
            return [];
        }
        const issueTypeMap = this.issueHierarchy.typeToIssueType;
        const primaryType = issueTypeMap[this.primaryIssueType];
        if(!primaryType) {
            console.warn("no primary issuetype?!?!");
            return [];
        }
        return [ ...primaryType.denormalizedChildren];
    }*/

    get rawIssuesPromise(){
        if(this.loginComponent.isLoggedIn === false || ! this.jql) {
          return;
        }
        this.progressData = null;
  
        const loadIssues = this.loadChildren ? 
          this.jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers) :
          this.jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(this.jiraHelpers);
        
        return loadIssues({
            jql: this.jql,
            fields: ["summary",
                "Rank",
                "Start date",
                "Due date",
                "Issue Type",
                "Fix versions",
                "Story points",
                //"Story Points", // This does not match a field returned by Jira but afraid to change at the moment.
                "Story points median",
                "Confidence",
                "Story points confidence",
                "Product Target Release", PARENT_LINK_KEY, LABELS_KEY, STATUS_KEY, "Sprint", "Epic Link", "Created","Parent"],
            expand: ["changelog"]
        }, (progressData)=> {
          this.progressData = {...progressData};
        }).then((rawIssues)=>{
          if( /*localStorage.getItem("percentComplete")*/ true  ) {
            setTimeout(()=>{
              percentComplete(rawIssues);
            },13);
          }
          return rawIssues;
        });
    }
    get timingLevelsPromise(){
        if(this.issueHierarchyPromise) {
            const timingCalculations = this.timingCalculations;
            return this.issueHierarchyPromise.then( issueHierarchy => {
                return getTimingLevels(issueHierarchy.typeToIssueType, this.primaryIssueType, timingCalculations)
            })
        }
        
    }
    get firstIssueTypeWithStatusesPromise(){

        if(this.primaryIssueType !== "Release") {
          return Promise.resolve(this.primaryIssueType);
        }

        if(this.issueHierarchyPromise) {
            const timingCalculations = this.timingCalculations;
            return this.issueHierarchyPromise.then( issueHierarchy => {
                const calculations= getImpliedTimingCalculations(this.primaryIssueType, issueHierarchy.typeToIssueType, timingCalculations);
                if(calculations[0].type !== "Release") {
                    return calculations[0].type;
                } else {
                    return calculations[1].type;
                }
            })
        }
        
        
    }
    get secondaryIssueTypePromise(){
        if(this.primaryIssueType !== "Release") {
            return Promise.resolve(undefined);
        }

        if(this.issueHierarchyPromise) {
            const timingCalculations = this.timingCalculations;
            return this.issueHierarchyPromise.then( issueHierarchy => {
                const calculations = getImpliedTimingCalculations(this.primaryIssueType, issueHierarchy.typeToIssueType, timingCalculations);
                if(calculations.length) {
                    return calculations[0].type
                }
            })
        }

        
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