import { StacheElement, type, ObservableObject, ObservableArray, value, diff } from "../can.js";

import {saveJSONToUrl,updateUrlParam} from "../shared/state-storage.js";

import { allStatusesSorted, allReleasesSorted } from "../jira/normalized/normalize.js";

import { pushStateObservable } from "../shared/state-storage.js";

import "../status-filter.js";

import SimpleTooltip from "../shared/simple-tooltip.js";
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



class SelectViewSettingsDropdown extends StacheElement {
    static view = `
    <div class="p-2">

        {{# if(this.canGroup) }}
        <div>
            <div class="font-bold uppercase text-slate-300 text-xs">Group by: </div>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, '')"
                on:change="this.groupBy = ''"
                /> None</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, 'parent')"
                on:change="this.groupBy = 'parent'"
                /> Parent</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="groupBy"
                checked:from="eq(this.groupBy, 'team')"
                on:change="this.groupBy = 'team'"
                /> Team (or Project)</label>
        </div>
        {{/ if }}


        
        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">Sort By:</div>
             <label class="px-2 block"><input 
                type="radio" 
                name="sortByDueDate"
                checked:from="not(this.sortByDueDate)"
                on:change="this.sortByDueDate = false"
                /> JQL Order</label>
            <label class="px-2 block"><input 
                type="radio" 
                name="sortByDueDate"
                checked:from="this.sortByDueDate"
                on:change="this.sortByDueDate = true"
                /> Due Date</label>    
        </div>

        {{# if(this.primaryIssueType) }}
            <div class="my-4">
                <div class="font-bold uppercase text-slate-300 text-xs">Status Filters:</div>

                <div class="grid gap-2" style="grid-template-columns: max-content max-content">
                    <label>Show only {{this.firstIssueTypeWithStatuses}} statuses:</label>
                
                    <status-filter 
                        statuses:from="this.statuses"
                        param:raw="statusesToShow"
                        selectedStatuses:bind="this.statusesToShow"
                        inputPlaceholder:raw="Search for statuses"
                        style="max-width: 400px;">
                    </status-filter>

                    <label>Hide {{this.firstIssueTypeWithStatuses}} statuses:</label>

                    <status-filter 
                        statuses:from="this.statuses" 
                        param:raw="statusesToRemove"
                        selectedStatuses:bind="this.statusesToRemove"
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

                {{# eq(this.primaryIssueType, "Release") }}
                        <label class=''>Show only Semver-like releases</label>
                        <input type='checkbox' 
                            class='self-start mt-1.5'  checked:bind='this.showOnlySemverReleases'/>
                        <p class="m-0">Format: <code>[NAME]_[D.D.D]</code>. Examples:
                        <code>ACME_1.2.3</code>, <code>ACME_CHECKOUT_1</code>, <code>1.2</code>.
                        </p>
                {{/ }}
            </div>

            <div class="my-4">
                <div class="font-bold uppercase text-slate-300 text-xs">Timing Filters:</div>

                <input type='checkbox' 
                    class='self-start mt-1.5' checked:bind='this.hideUnknownInitiatives'/> Hide {{this.primaryIssueType}}s without dates 
            </div>
        {{/ if }}



        <div class="my-4">
            <div class="font-bold uppercase text-slate-300 text-xs">View Options</div>
            <div class="flex mt-2 gap-2 flex-wrap">
                <input type='checkbox' 
                    class='self-start mt-1.5'  checked:bind='this.primaryReportBreakdown'/>
                <p>Show work breakdown</p>
                
            </div>

            <div class="flex mt-2 gap-2 flex-wrap">
                <input type='checkbox' 
                    class='self-start mt-1.5'  checked:bind='this.showPercentComplete'/>
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
                    selectedStatuses:bind="this.planningStatuses"
                    inputPlaceholder:raw="Search for statuses"
                    style="max-width: 400px;"></status-filter>
            </div>
            {{/ if}}
        </div>
    </div>
    `
}
customElements.define("select-view-settings-dropdown", SelectViewSettingsDropdown);


export class SelectViewSettings extends StacheElement {
    static view = `
        <button 
                class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}"
                on:click="this.showChildOptions()">View Settings <img class="inline" src="/images/chevron-down.svg"/></button>
    `;
    static props ={
        primaryReportBreakdown: saveJSONToUrl("primaryReportBreakdown", false, Boolean, booleanParsing),
        secondaryReportType: saveJSONToUrl("secondaryReportType", "none", String, {parse: x => ""+x, stringify: x => ""+x}),
        showPercentComplete: saveJSONToUrl("showPercentComplete", false, Boolean, booleanParsing),

        // group by doesn't make sense for a release
        
        groupBy: {
            value({resolve, lastSet, listenTo}) {
                function getFromParam() {
                    return new URL(window.location).searchParams.get("groupBy") || "";
                }

                const reconcileCurrentValue = (primaryIssueType, currentGroupBy) => {
                    if(primaryIssueType === "Release") {
                        updateUrlParam("groupBy", "", "");
                    } else {
                        updateUrlParam("groupBy", currentGroupBy, "");
                    }
                }
                
                listenTo("primaryIssueType",({value})=> {    
                    reconcileCurrentValue(value, getFromParam());
                });

                listenTo(lastSet, (value)=>{
                    updateUrlParam("groupBy", value || "", "");
                });

                listenTo(pushStateObservable, ()=>{
                    resolve( getFromParam() );
                })

                
                resolve(getFromParam());
            }
        },



        sortByDueDate: saveJSONToUrl("sortByDueDate", false, Boolean, booleanParsing),
        hideUnknownInitiatives: saveJSONToUrl("hideUnknownInitiatives", false, Boolean, booleanParsing),

        showOnlySemverReleases: saveJSONToUrl("showOnlySemverReleases", false, Boolean, booleanParsing),

        
        // STATUS FILTERING STUFF
        
        // used for later filtering
        // but the options come from the issues
        
        statusesToShow: makeArrayOfStringsQueryParamValue("statusesToShow"),
        statusesToRemove: makeArrayOfStringsQueryParamValue("statusesToRemove"),
        planningStatuses: makeArrayOfStringsQueryParamValue("planningStatuses"),

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
                    return this.secondaryIssueType;
                }
            }
        },
        get canGroup(){
            return this.primaryReportType === 'start-due' &&
                this.primaryIssueType && this.primaryIssueType !== "Release"
        }
        
    }
    showChildOptions(){
        
        let dropdown = new SelectViewSettingsDropdown().bindings({
            showPercentComplete: value.bind(this,"showPercentComplete"),
            secondaryReportType: value.bind(this,"secondaryReportType"),
            
            groupBy: value.bind(this,"groupBy"),
            sortByDueDate: value.bind(this,"sortByDueDate"),
            hideUnknownInitiatives: value.bind(this,"hideUnknownInitiatives"),
            showOnlySemverReleases: value.bind(this,"showOnlySemverReleases"),
            primaryReportBreakdown: value.bind(this,"primaryReportBreakdown"),

            primaryReportType: this.primaryReportType,

            statusesToRemove: value.bind(this,"statusesToRemove"),
            statusesToShow: value.bind(this,"statusesToShow"),
            planningStatuses: value.bind(this,"planningStatuses"),

            


            secondaryIssueType: value.from(this,"secondaryIssueType"),
            primaryIssueType: value.from(this,"primaryIssueType"),
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


function makeArrayOfStringsQueryParamValue(queryParam){
    return {
        value: function({resolve, lastSet, listenTo}){
            function urlValue(){
                let value = new URL(window.location).searchParams.get(queryParam);
                return !value ? [] : value.split(",")
            }
            let currentValue = urlValue();
            resolve(currentValue);
    
            listenTo(lastSet, (value)=>{
                console.log("SETTING")
                if(!value) {
                    value = "";
                } else if( Array.isArray(value) ){
                    value = value.join(",")
                }
                updateUrlParam(queryParam, value, "");
            });
    
            listenTo(pushStateObservable, (ev)=>{
                console.log("ROUTE CHANGED", ev)
                let newValue = urlValue();
                if(diff.list(newValue, currentValue).length) {
                    resolve(currentValue = newValue);
                }
            })
        }
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