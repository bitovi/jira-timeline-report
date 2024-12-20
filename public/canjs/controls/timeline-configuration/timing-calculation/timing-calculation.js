import { StacheElement, type, ObservableObject, ObservableArray, value } from "../../../../can.js";

import {updateUrlParam} from "../../../routing/state-storage.js";

import { getSimplifiedIssueHierarchy } from "../../../../stateful-data/jira-data-requests.js";

const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"


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
        get jiraIssueHierarchyPromise(){
            return getSimplifiedIssueHierarchy({
                isLoggedIn: this.jiraHelpers.hasValidAccessToken(),
                jiraHelpers: this.jiraHelpers,
            }) 
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
                const allLevels = getTimingLevels(this.issueHierarchy, this.timingCalculations);
                return allLevels.slice(0, allLevels.length - 1);
            }
        },
        timingCalculations: {
            value({resolve, lastSet, listenTo}) {
              let currentValue;
              updateValue(new URL(window.location).searchParams.get("timingCalculations"));
  
              listenTo(lastSet, (value)=>{
                  updateValue(value);
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
                let phrases = value.split(",");
                const data = {};
                for(let phrase of phrases) {
                    const parts = phrase.split(":");
                    data[parts[0]] = parts[1]
                }
                return data;
              }
              function stringify(obj){
                return Object.keys(obj).map( (key)=> key+":"+obj[key]).join(",");
              }
  
            }
        },
        get issueTimingCalculations(){
            if(!this.issueHierarchy) {
                return [];
            } else {
                const allLevels = getTimingLevels(this.issueHierarchy, this.timingCalculations);
                return allLevels.map( level => {
                    return {
                        type: level.type,
                        hierarchyLevel: level.hierarchyLevel,
                        calculation: level.calculations.find( (level) => level.selected).calculation
                    }
                })
            }
        }
    }
    
      
    updateCalculation(type, value){
        let current = {...this.timingCalculations};
        if(value === DEFAULT_CALCULATION_METHOD) {
            delete current[type]
        } else {
            current[type] = value;
        }
    
        this.timingCalculations = current;
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


export const calculationKeysToNames = {
    parentFirstThenChildren: function(parent, child){
        return `From ${parent.type}, then ${child.plural}`
    },
    childrenOnly: function(parent, child){
        return `From ${child.plural}`
    },
    childrenFirstThenParent: function(parent, child){
        return `From ${child.plural}, then ${parent.type}`
    },
    widestRange: function(parent, child){
        return `From ${parent.type} or ${child.plural} (earliest to latest)`
    },
    parentOnly: function(parent, child){
        return `From ${parent.type}`
    }
}

function createBaseLevels(issueHierarchy) {
    return issueHierarchy.map((issue)=> {
        return {
            type: issue.name,
            source: issue,
            plural: issue.name+"s",
            hierarchyLevel: issue.hierarchyLevel
        }
    });
}

function calculationsForLevel(parent, child, selected, last){
    if(!last) {
        return Object.keys(calculationKeysToNames).map( calculationName => {
            return {
                parent: parent.type,
                child: child.type,
                calculation: calculationName,
                name:  calculationKeysToNames[calculationName](parent, child),
                selected: selected ? selected === calculationName : "widestRange" === calculationName
            }
        })
    } else {
        return [{
            parent: parent.type,
            child: null,
            calculation: "parentOnly",
            name:  calculationKeysToNames.parentOnly(parent),
            selected: true
        }];
    }
}

/*
return {
    child: issueTypeName, 
    parent: issueType.type, 
    calculation: calculationName, name: calculationKeysToNames[calculationName](issueType, typeToIssueType[issueTypeName]) }
*/

/**
* 
* @param {TimingCalculationsMap} issueTypeMap 
* @param {string} primaryIssueType 
* @param {Array<TimingCalculation>} timingCalculations 
* @returns 
*/
function getTimingLevels(issueHierarchy, timingCalculations){


    const baseLevels = createBaseLevels(issueHierarchy);

    return baseLevels.map( (level, i)=> {
        const child = baseLevels[i+1];
        const isLast = i === baseLevels.length - 1;

        return {
            ...level,
            childType: child ? child.type : null,
            calculations: calculationsForLevel(level, child, timingCalculations[level.type], isLast)
        }
    });
    
   
}


customElements.define("timing-calculation", TimingCalculation);