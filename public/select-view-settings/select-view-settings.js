import { StacheElement, type, ObservableObject, ObservableArray, value } from "../can.js";

import {saveJSONToUrl,updateUrlParam} from "../shared/state-storage.js";
import { calculationKeysToNames, allTimingCalculationOptions, getImpliedTimingCalculations } from "../prepare-issues/date-data.js";

import { rawIssuesRequestData, configurationPromise, derivedIssuesRequestData, serverInfoPromise} from "./state-helpers.js";

import { allStatusesSorted, allReleasesSorted } from "../jira/normalized/normalize.js";

import "../status-filter.js";

const booleanParsing = {
    parse: x => {
      return ({"": true, "true": true, "false": false})[x];
    },
    stringify: x => ""+x
  };


const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"

/*
class TypeSelectionDropdown extends StacheElement {
    static view = `
        {{# for(issueType of this.allTimingCalculationOptions.list) }}
        <label class="px-2"><input 
            type="radio" 
            name="primaryIssueType" 
            checked:from="eq(this.primaryIssueType, issueType.type)"
            on:change="this.primaryIssueType = issueType.type"/> {{issueType.plural}} </label>
        {{/ }}
    `
}*/

const attrsToAdd = `
    statusesToRemove:to="this.statusesToRemove"
          statusesToShow:to="this.statusesToShow"
                    showOnlySemverReleases:to="this.showOnlySemverReleases"
          secondaryReportType:to="this.secondaryReportType"
          hideUnknownInitiatives:to="this.hideUnknownInitiatives"
          sortByDueDate:to="this.sortByDueDate"
          showPercentComplete:to="this.showPercentComplete"
          planningStatuses:to="this.planningStatuses"
          groupBy:to="this.groupBy"
          releasesToShow:to="this.releasesToShow"
          statusesToExclude:to="this.statusesToExclude"
`

export class SelectViewSettings extends StacheElement {
    static view = `
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

        <div class="flex mt-2 gap-2 flex-wrap">
            <p>Do you want to report on completion percentage?</p>
            <input type='checkbox' 
                class='self-start mt-1.5'  checked:bind='this.showPercentComplete'/>
        </div>


        {{# eq(this.primaryReportType, 'start-due') }}
        <h3 class="h3">Grouping</h3>
        <div>
            Group by: 
            <label class="px-2"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, '')"
                on:change="this.groupBy = ''"
                /> None</label>
            <label class="px-2"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, 'parent')"
                on:change="this.groupBy = 'parent'"
                /> Parent</label>
            <label class="px-2"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, 'team')"
                on:change="this.groupBy = 'team'"
                /> Team (or Project)</label>
        </div>
        {{/ eq }}


        <h3 class="h3">Sorting</h3>
        <div class="grid gap-3" style="grid-template-columns: max-content max-content 1fr">
            <label class=''>Sort by Due Date</label>
            <input type='checkbox' 
                class='self-start mt-1.5' checked:bind='this.sortByDueDate'/>
            <p class="m-0">Instead of ordering initiatives based on the order defined in the JQL, 
            sort initiatives by their last epic's due date.
            </p>
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
                inputPlaceholder:raw="Search for statuses"
                style="max-width: 400px;">
            </status-filter>
            <p>Only include these statuses in the report</p>

            <label>{{this.firstIssueTypeWithStatuses}} Statuses to Ignore</label>
            <status-filter 
                statuses:from="this.statuses" 
                param:raw="statusesToRemove"
                selectedStatuses:to="this.statusesToRemove"
                inputPlaceholder:raw="Search for statuses"
                style="max-width: 400px;">
                </status-filter>
            <p>Search for statuses to remove from the report</p>

            <label>{{this.firstIssueTypeWithStatuses}} Release to Report</label>
            <status-filter 
                statuses:from="this.releases"
                param:raw="releasesToShow"
                selectedStatuses:to="this.releasesToShow"
                inputPlaceholder:raw="Search for releases"
                style="max-width: 400px;"></status-filter>
            <p>Search for releases to include in the report</p>


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

        {{# if(this.firstIssueTypeWithStatuses) }}
        <div class="flex gap-2 mt-1">
            <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>
            <status-filter 
                statuses:from="this.statuses" 
                param:raw="planningStatuses"
                selectedStatuses:to="this.planningStatuses"
                inputPlaceholder:raw="Search for statuses"
                style="max-width: 400px;"></status-filter>
        </div>
        {{/ if}}
    `;
    static props ={
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {parse: x => ""+x, stringify: x => ""+x}),
        showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),
        groupBy: saveJSONToUrl("groupBy", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),

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
        },
        get releases(){
            if(this.derivedIssues) {
                return allReleasesSorted(this.derivedIssues)
            } else {
                return [];
            }
        },
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
    }
}


customElements.define("select-view-settings", SelectViewSettings);