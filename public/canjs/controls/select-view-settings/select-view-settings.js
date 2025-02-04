import { StacheElement, value } from "../../../can.js";
import { allReleasesSorted } from "../../../jira/normalized/normalize.js";
import { DROPDOWN_LABEL } from "../../../shared/style-strings.js";

import routeData from "../../routing/route-data";
import SimpleTooltip from "../../ui/simple-tooltip/simple-tooltip";

import "../status-filter.js";

import {roundDate} from "../../../utils/date/round.js";

const ROUNDING_OPTIONS = [
    {key: "day", name: "Day"},
    {key: "week", name: "Week"},
    {key: "month", name: "Month"},
    {key: "halfQuarter", name: "Half Quarter"},
    {key: "quarter", name: "Quarter"}
];

// A quick check that we don't have anything wrong
ROUNDING_OPTIONS.forEach( ({key})=> { 
    if(!roundDate[key]) {
        console.error("Missing rounding capability ", key);
    }
});

const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

const booleanParsing = {
    parse: x => {
      return ({"": true, "true": true, "false": false})[x];
    },
    stringify: x => ""+x
  };


const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
const hoverEffect = "hover:bg-neutral-301 cursor-pointer";

class SelectViewSettingsDropdown extends StacheElement {
    static view = `
    <div class="p-2">

        {{# if(this.canGroup) }}
        <div>
            <div class="font-bold uppercase text-slate-300 text-xs">Group by: </div>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.routeData.groupBy, '')"
                on:change="this.routeData.groupBy = ''"
                /> None</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.routeData.groupBy, 'parent')"
                on:change="this.routeData.groupBy = 'parent'"
                /> Parent</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.routeData.groupBy, 'team')"
                on:change="this.routeData.groupBy = 'team'"
                /> Team (or Project)</label>
        </div>
        {{/ if }}


        
        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">Sort By:</div>
             <label class="px-2 block"><input 
                type="radio" 
                name="sortByDueDate"
                checked:from="not(this.routeData.sortByDueDate)"
                on:change="this.routeData.sortByDueDate = false"
                /> JQL Order</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="sortByDueDate"
                checked:from="this.routeData.sortByDueDate"
                on:change="this.routeData.sortByDueDate = true"
                /> Due Date</label>    
        </div>

        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">Round Dates To:</div>
            <select class="rounded-sm border-2 bg-white border-neutral-80 p-2" value:bind="this.routeData.roundTo">
                {{# for(option of this.roundingOptions) }}
                    <option value:from="option.key">{{option.name}}</option>
                {{/ }}
            </select>
        </div>


        {{# if(this.routeData.primaryIssueType) }}
            <div class="my-4">
                <div class="font-bold uppercase text-slate-300 text-xs">Status Filters:</div>

                <div class="grid gap-2" style="grid-template-columns: max-content max-content">
                    <label>Show only {{this.firstIssueTypeWithStatuses}} statuses:</label>
                
                    <status-filter 
                        statuses:from="this.statuses"
                        param:raw="statusesToShow"
                        selectedStatuses:bind="this.routeData.statusesToShow"
                        inputPlaceholder:raw="Search for statuses"
                        style="max-width: 400px;">
                    </status-filter>

                    <label>Hide {{this.firstIssueTypeWithStatuses}} statuses:</label>

                    <status-filter 
                        statuses:from="this.statuses" 
                        param:raw="statusesToRemove"
                        selectedStatuses:bind="this.routeData.statusesToRemove"
                        inputPlaceholder:raw="Search for statuses"
                        style="max-width: 400px;">
                        </status-filter>

                    
                </div>
            </div>
            <div class="my-4">
                <div class="font-bold uppercase text-slate-300 text-xs">Release Filters:</div>

                <div class="grid gap-2" style="grid-template-columns: max-content max-content">
                    <label>Show only {{this.firstIssueTypeWithStatuses}}s with releases:</label>
                
                    <status-filter 
                        statuses:from="this.releases"
                        param:raw="releasesToShow"
                        selectedStatuses:to="this.releasesToShow"
                        inputPlaceholder:raw="Search for releases"
                        style="max-width: 400px;"></status-filter>

                    
                </div>

                {{# eq(this.routeData.primaryIssueType, "Release") }}
                        <label class=''>Show only Semver-like releases</label>
                        <input type='checkbox' 
                            class='self-start mt-1.5'  checked:bind='this.routeData.showOnlySemverReleases'/>
                        <p class="m-0">Format: <code>[NAME]_[D.D.D]</code>. Examples:
                        <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
                        </p>
                {{/ }}
            </div>

            <div class="my-4">
                <div class="font-bold uppercase text-slate-300 text-xs">Timing Filters:</div>

                <input type='checkbox' 
                    class='self-start mt-1.5' checked:bind='this.routeData.hideUnknownInitiatives'/> Hide {{this.routeData.primaryIssueType}}s without dates 
            </div>
        {{/ if }}



        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">View Options</div>
            <div class="flex mt-2 gap-2 flex-wrap">
                <input type='checkbox' 
                    class='self-start mt-1.5'  checked:bind='this.routeData.primaryReportBreakdown'/>
                <p>Show work breakdown</p>
                
            </div>

            <div class="flex mt-2 gap-2 flex-wrap">
                <input type='checkbox' 
                    class='self-start mt-1.5'  checked:bind='this.routeData.showPercentComplete'/>
                <p>Show completion percentage</p>
                
            </div>
        </div>

        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">Secondary Status Report</div>
            <div class="flex mt-2 gap-2 flex-wrap">
                <p>Secondary Report Type</p>
                <div class="shrink-0">
                <label class="px-2"><input 
                    type="radio" 
                    name="secondary" 
                    checked:from="eq(this.routeData.secondaryReportType, 'none')"
                    on:change="this.routeData.secondaryReportType = 'none'"
                    /> None </label>
                    
                <label class="px-2"><input 
                    type="radio" 
                    name="secondary" 
                    checked:from="eq(this.routeData.secondaryReportType, 'status')"
                    on:change="this.routeData.secondaryReportType = 'status'"
                    /> {{this.routeData.secondaryIssueType}} status </label>
                
                {{# not(eq(this.routeData.secondaryIssueType, "Story") ) }}
                <label class="px-2"><input 
                    type="radio" 
                    name="secondary" 
                    checked:from="eq(this.routeData.secondaryReportType, 'breakdown')"
                    on:change="this.routeData.secondaryReportType = 'breakdown'"
                    /> {{this.routeData.secondaryIssueType}} work breakdown </label>
                {{/ not }}
                </div>
            </div>

            {{# if(this.firstIssueTypeWithStatuses) }}
            <div class="flex gap-2 mt-1">
                <label>{{this.firstIssueTypeWithStatuses}} statuses to show as planning:</label>
                <status-filter 
                    statuses:from="this.statuses" 
                    param:raw="planningStatuses"
                    selectedStatuses:bind="this.routeData.planningStatuses"
                    inputPlaceholder:raw="Search for statuses"
                    style="max-width: 400px;"></status-filter>
            </div>
            {{/ if}}
        </div>
    </div>
    `;
    static props = {
        roundingOptions: {
            get default(){
                return ROUNDING_OPTIONS;
            }
        },
        routeData: {
            get default(){
                return routeData;
            }
        },
    }
}
customElements.define("select-view-settings-dropdown", SelectViewSettingsDropdown);

export class SelectViewSettings extends StacheElement {
    static view = `
        <label for="viewSettings" class="${DROPDOWN_LABEL} invisible">View settings</label>
        <button 
                id="viewSettings"
                class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}"
                on:click="this.showChildOptions()">View Settings <img class="inline" src="/images/chevron-down.svg"/></button>
    `;
    static props ={
        routeData: {
            get default() {
                return routeData;

            }
        },
        // STATUS FILTERING STUFF
        
        // used for later filtering
        // but the options come from the issues
        
        get releases(){
            if(this.derivedIssues) {
                return allReleasesSorted(this.derivedIssues)
            } else {
                return [];
            }
        },
        get firstIssueTypeWithStatuses(){
            if(this.routeData.primaryIssueType) {
                if(this.routeData.primaryIssueType !== "Release") {
                    return this.routeData.primaryIssueType;
                } else {
                    return this.routeData.secondaryIssueType;
                }
            }
        },
        get canGroup(){
            return this.routeData.primaryReportType === 'start-due' &&
                this.routeData.primaryIssueType && this.routeData.primaryIssueType !== "Release"
        }
        
    }
    showChildOptions(){
        
        let dropdown = new SelectViewSettingsDropdown().bindings({
            canGroup: value.from(this,"canGroup"),
            firstIssueTypeWithStatuses: value.from(this,"firstIssueTypeWithStatuses"),

            // this could probably be calculated by itself
            statuses: value.from(this,"statuses"),
            releases: value.from(this,"releases")
            // onSelection: this.onSelection.bind(this)
        })
        
        TOOLTIP.belowElementInScrollingContainer(this, dropdown);
    }
    connected(){
        this.listenTo(window, "click", (event)=>{
          if(!TOOLTIP.contains(event.target) && ! findParentWithSelector(event.target, "simple-tooltip"))   {
            TOOLTIP.leftElement();
          }
        })
    }
}




function findParentWithSelector(element, selector) {
    let parent = element.parentElement;
    while (parent) {
      if (parent.matches(selector)) {
        return parent;
      }
      parent = parent.parentElement;
    }
    return null;
  }


customElements.define("select-view-settings", SelectViewSettings);
