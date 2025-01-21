import { StacheElement, type, ObservableObject, ObservableArray, value } from "../../../../can.js";

import {updateUrlParam} from "../../../routing/state-storage.js";

import { getSimplifiedIssueHierarchy } from "../../../../stateful-data/jira-data-requests.js";
import routeData from "../../../routing/route-data.js";

const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"


import {getTimingLevels} from "./helpers.js";

const DEFAULT_CALCULATION_METHOD = "widestRange";

export class TimingCalculation extends StacheElement {
    static view = `
        <h3 class="h3">Timing Calculation</h3>
        <div class="grid gap-2 my-2" style="grid-template-columns: auto auto auto;">
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 1 / span 1; grid-row: 1 / span 1;">Parent Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 2 / span 1; grid-row: 1 / span 1;">Child Type</div>
            <div class="text-sm py-1 text-slate-600 font-semibold" style="grid-column: 3 / span 1; grid-row: 1 / span 1;">How is timing calculated between parent and child?</div>
            <div class="border-b-2 border-neutral-40" style="grid-column: 1 / span 3; grid-row: 1 / span 1;"></div>

            {{# for(timingLevel of this.selectableTimingLevels) }}

                <label class="pr-2 py-2 {{ this.paddingClass(scope.index) }}">{{timingLevel.type}}</label>
                <span class="p-2">{{timingLevel.childType}}</span>
                

                <select class="${selectStyle}" on:change="this.updateCalculation(timingLevel.type, scope.element.value)">
                {{# for(calculation of timingLevel.calculations) }}
                    <option {{# if(calculation.selected) }}selected{{/ if }} value="{{calculation.calculation}}">{{calculation.name}}</option>
                {{/ for }}
                </select>

            {{/ for }}
            
        </div>
    `;
    static props = {
        routeData: {
            get default() {
                return routeData;
            }
        },
        get jiraIssueHierarchyPromise(){
            return this.routeData.simplifiedIssueHierarchyPromise;
        },
        issueHierarchy: {
            async(resolve){
                return this.jiraIssueHierarchyPromise
            }
        },
        get selectableTimingLevels(){
            if(!this.issueHierarchy) {
                return [];
            } else {
                const allLevels = getTimingLevels(this.issueHierarchy, this.routeData.timingCalculations);
                return allLevels.slice(0, allLevels.length - 1);
            }
        }
    }
    
      
    updateCalculation(type, value){
        let current = {...this.routeData.timingCalculations};
        if(value === DEFAULT_CALCULATION_METHOD) {
            delete current[type]
        } else {
            current[type] = value;
        }
    
        this.routeData.timingCalculations = current;
    }


    // UI Helpers
    paddingClass(depth) {
        return "pl-"+(depth * 2);
    }
    
}


function getIssueHierarchy(types){
    
    const levelsToTypes = []
    for( let type of types) {
        // ignore subtasks
        if(type.hierarchyLevel >=0) {
            if(!levelsToTypes[type.hierarchyLevel]) {
                levelsToTypes[type.hierarchyLevel] = [];
            }
            levelsToTypes[type.hierarchyLevel].push(type)
        }
        
    }
    
    return levelsToTypes.map( (types, i) => {
        return types[0];
    }).filter( i => i ).reverse()
}

/**
 * @type {{
*   type: string, 
*   calculation: string
* }} TimingCalculation
*/






customElements.define("timing-calculation", TimingCalculation);
