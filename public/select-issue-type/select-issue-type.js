import { StacheElement, type, ObservableObject, ObservableArray, value, queues } from "../can.js";

import {updateUrlParam, pushStateObservable} from "../shared/state-storage.js";
import { bitoviTrainingIssueData } from "../examples/bitovi-training.js";
import { getSimplifiedIssueHierarchy } from "../stateful-data/jira-data-requests.js";
import { mostCommonElement } from "../shared/array-helpers.js";

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

const hoverEffect = "hover:bg-neutral-301 cursor-pointer"



const RELEASES_TOOLTIP = new SimpleTooltip();
document.body.append(RELEASES_TOOLTIP);

class TypeSelectionDropdown extends StacheElement {
    static view = `
        {{# for(issueType of this.issueHierarchy) }}
        <label class="px-4 py-2 block {{#eq(this.primaryIssueType, issueType.name)}}bg-blue-101{{else}}${hoverEffect}{{/eq}}"><input 
            type="radio" 
            name="primaryIssueType" 
            checked:from="eq(this.primaryIssueType, issueType.name)"
            on:change="this.onSelection(issueType.name)"/> {{issueType.name}}s </label>
        {{/ }}
        <label class="px-4 py-2  block {{#eq(this.primaryIssueType, 'Release')}}bg-blue-101{{else}}${hoverEffect}{{/eq}} border-t border-t-2 border-t-neutral-301"
            on:mouseenter="this.showReleases(scope.element)">
            Releases <img class="inline" src="/images/chevron-right-new.svg"/> 
        </label>
    `
    showReleases(label) {
        let dropdown = new ReleasesTypeSelectionDropdown().initialize({
            issueHierarchy: this.issueHierarchy,
            onSelection: this.onSelection,
            secondaryIssueType: this.secondaryIssueType
        })

        RELEASES_TOOLTIP.rightOfElementInScrollingContainer(label, dropdown);
    }
}
customElements.define("select-type-dropdown", TypeSelectionDropdown);


class ReleasesTypeSelectionDropdown extends StacheElement {
    static view = `
        {{# for(issueType of this.issueHierarchy) }}
        <label class="px-4 py-2 block {{#eq(this.secondaryIssueType, issueType.name)}}bg-blue-101{{else}}${hoverEffect}{{/eq}}"><input 
            type="radio" 
            name="primaryIssueType" 
            checked:from="eq(this.secondaryIssueType, issueType.name)"
            on:change="this.onSelection('Release', issueType.name)"/> {{issueType.name}}s </label>
        {{/ }}
    `
}
customElements.define("select-release-type-dropdown", ReleasesTypeSelectionDropdown);




export class SelectIssueType extends StacheElement {
    static view = `
        {{# not(this.primaryIssueType) }}
            <button class="rounded bg-neutral-201 px-3 py-1">Loading ... </button>
        {{/ }}
        {{# if(this.primaryIssueType) }}
            <button class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}" on:click="this.showChildOptions()">
                {{this.primaryIssueType}}s
                {{# if(this.secondaryIssueType) }} / {{this.secondaryIssueType}}s {{/ if }}
                <img class="inline" src="/images/chevron-down.svg"/>
            </button>
        {{/ }}
    `;
    static props ={
        simplifiedIssueHierarchy: {
            async(){
                return getSimplifiedIssueHierarchy({
                    isLoggedIn: this.jiraHelpers.hasValidAccessToken(),
                    jiraHelpers: this.jiraHelpers,
                });
            }

        },
        
        get issueHierarchy(){
            
            return this.derivedIssues && this.derivedIssues.length ?
                issueHierarchyFromNormalizedIssues(this.derivedIssues) :
                this.simplifiedIssueHierarchy;
            
        },


        primaryIssueType: {
            value({resolve, lastSet, listenTo}) {

                const reconcileCurrentValue = (issueHierarchy, primaryIssueType) => {
                    
                    if(primaryIssueType === "Release") {
                        resolve(primaryIssueType);
                    } else if(this.issueHierarchy && this.issueHierarchy.length) {
                        if(this.issueHierarchy.some( issue => issue.name === primaryIssueType ) ) {
                            resolve(primaryIssueType);
                        } else {
                            updateUrlParam("primaryIssueType", "", "");
                            resolve(currentPrimaryIssueType = this.issueHierarchy[0].name)
                        }
                    } else {
                        resolve(undefined);
                    }
                    
                }
                
                let currentPrimaryIssueType = new URL(window.location).searchParams.get("primaryIssueType");

                listenTo("issueHierarchy",({value})=> {
                    reconcileCurrentValue(value, currentPrimaryIssueType);
                });

                listenTo(lastSet, (value)=>{
                    setCurrentValue(value);
                });

                listenTo(pushStateObservable, ()=>{
                    reconcileCurrentValue(this.issueHierarchy, new URL(window.location).searchParams.get("primaryIssueType"));
                })

                //setCurrentValue(new URL(window.location).searchParams.get("primaryIssueType") )

                
                reconcileCurrentValue(this.issueHierarchy, currentPrimaryIssueType);

                

                function setCurrentValue(value) {
                    currentPrimaryIssueType = value;
                    updateUrlParam("primaryIssueType", value, "");
                    // calculationOptions ... need to pick the right one if empty
                    resolve(value)
                }
            }
        },
        secondaryIssueType: {
            value({resolve, lastSet, listenTo}) {

                const reconcileCurrentValue = (issueHierarchy, primaryIssueType, secondaryIssueType) => {
                    if(this.primaryIssueType && primaryIssueType === "Release") {
                        if(issueHierarchy && this.issueHierarchy.length) {
                            if(issueHierarchy.some( issue => issue.name === secondaryIssueType ) ) {
                                resolve(secondaryIssueType);
                            } else {
                                updateUrlParam("secondaryIssueType", "", "");
                                resolve(secondaryIssueType = issueHierarchy[0].name)
                            }
                        }
                    } else {
                        resolve(undefined);
                    }

                }
                
                let currentSecondaryIssueType = new URL(window.location).searchParams.get("secondaryIssueType");

                listenTo("issueHierarchy",({value})=> {
                    reconcileCurrentValue(value, this.primaryIssueType, currentSecondaryIssueType);
                });
                listenTo("primaryIssueType",({value})=> {
                    reconcileCurrentValue(this.issueHierarchy, value, currentSecondaryIssueType);
                });

                listenTo(lastSet, (value)=>{
                    setCurrentValue(value);
                });

                //setCurrentValue(new URL(window.location).searchParams.get("primaryIssueType") )

                
                reconcileCurrentValue(this.issueHierarchy, this.primaryIssueType, currentSecondaryIssueType);

                function setCurrentValue(value) {
                    currentSecondaryIssueType = value;
                    updateUrlParam("secondaryIssueType", value, "");
                    resolve(value)
                }
            }
        }
        /*
        get secondaryIssueType(){
            if(this.primaryIssueType) {
                const calculations = this.impliedTimingCalculations;
                if(calculations.length) {
                    return calculations[0].type
                }
            }
            
        },*/
    };
    onSelection(primaryType, secondaryType){
        queues.batch.start();
        this.primaryIssueType = primaryType;
        if(secondaryType) {
            this.secondaryIssueType = secondaryType;
        }
        queues.batch.stop();
        TOOLTIP.leftElement();
        RELEASES_TOOLTIP.leftElement();
    }
    showChildOptions(){
        let dropdown = new TypeSelectionDropdown().initialize({
            primaryIssueType: this.primaryIssueType,
            secondaryIssueType: this.secondaryIssueType,
            issueHierarchy: this.issueHierarchy,
            onSelection: this.onSelection.bind(this)
        })

        TOOLTIP.belowElementInScrollingContainer(this, dropdown);
    }
    connected(){
        this.listenTo(window, "click", (event)=>{
          if(!TOOLTIP.contains(event.target))   {
            TOOLTIP.leftElement();
            RELEASES_TOOLTIP.leftElement();
          }
        })
    }
}

/**
 * 
 * @param {Array<import("../jira/normalized/normalize.js").NormalizedIssue>} normalizedIssues 
 * @returns {Array<{type: string, hierarchyLevel: number}>}
 */
function issueHierarchyFromNormalizedIssues(normalizedIssues){
    const levelsToNames = []
    for( let issue of normalizedIssues) {
        if(!levelsToNames[issue.hierarchyLevel]) {
            levelsToNames[issue.hierarchyLevel] = [];
        }
        levelsToNames[issue.hierarchyLevel].push(issue.type)
    }
    return levelsToNames.map( (names, i) => {
        return {name: mostCommonElement(names), hierarchyLevel: i}
    }).filter( i => i ).reverse()
}

customElements.define("select-issue-type", SelectIssueType);