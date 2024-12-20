import { StacheElement, type, ObservableObject, ObservableArray, value, queues } from "../../../can.js";

import {updateUrlParam, pushStateObservable} from "../../routing/state-storage.js";
import { bitoviTrainingIssueData } from "../../../examples/bitovi-training.js";
import { getSimplifiedIssueHierarchy } from "../../../stateful-data/jira-data-requests.js";
import { mostCommonElement } from "../../../utils/array/array-helpers.js";

import "../status-filter.js";

import SimpleTooltip from "../../ui/simple-tooltip/simple-tooltip";

import { DROPDOWN_LABEL } from "../../../shared/style-strings.js";

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
        <label for="reportOn" class="${DROPDOWN_LABEL}">Report on</label>
        {{# not(this.primaryIssueType) }}
            <button class="rounded bg-neutral-201 px-3 py-1" id="reportOn">Loading ... </button>
        {{/ }}
        {{# if(this.primaryIssueType) }}
            <button class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}" 
                on:click="this.showChildOptions()" 
                id="reportOn">
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
        // needs to be atomic
        // a value like `Initiative`
        // or `Release-Initiative`
        selectedIssueType: {
            value({resolve, lastSet, listenTo}) {
                function getParamValue(){
                    return new URL(window.location).searchParams.get("selectedIssueType") || "";
                }
                let timers = [];
                function clearTimers() {
                    timers.forEach((value) => clearTimeout(value));
                    timers = [];
                }

                // anything happens in state, update the route 
                // the route updates, update the state (or the route if it's wrong)
                const resolveCurrentValue = () => {
                    clearTimers();
                    const curParamValue = getParamValue();

                    // we wait to resolve to a defined value until we can check it's right
                    if(this.issueHierarchy && this.issueHierarchy.length) {
                        const curParamValue = getParamValue();

                        // helps with legacy support to pick the first type
                        if(curParamValue === "Release") {
                            resolve( "Release-"+this.issueHierarchy[0].name );
                        } else {
                            const curSelectedParts = toSelectedParts(curParamValue);
                            //const lastSelectedParts = toSelectedParts(lastSelectedValue);

                            if(curSelectedParts) {
                                // check it's ok
                                let typeToCheck = curSelectedParts.secondary ?? curSelectedParts.primary;
                                
                                if(this.issueHierarchy.some( issue => issue.name === typeToCheck ) ) {
                                    // make sure we actually need to update
                                    resolve(curParamValue);
                                } 
                                // set back to default
                                else {
                                    timers.push( setTimeout( ()=> {
                                        updateUrlParam("selectedIssueType", "", "");
                                    },20) );
                                }

                            } else {
                                // default to the first type
                                resolve( this.issueHierarchy[0].name );
                            }
                        }
                    } else {
                        resolve(undefined)
                    }
                }


                // when the route changes, check stuff ...
                listenTo(pushStateObservable, ()=>{
                    resolveCurrentValue();
                })
                
                listenTo("issueHierarchy",({value})=> {
                    resolveCurrentValue();
                });

                listenTo(lastSet, (value)=>{
                    console.log("LAST SET sit", value)
                    updateUrlParam("selectedIssueType", value, "");
                });

                resolveCurrentValue();

            }
        },
        get primaryIssueType() {
            return this.selectedIssueType && toSelectedParts(this.selectedIssueType).primary;
        },
        get secondaryIssueType() {
            return this.selectedIssueType && toSelectedParts(this.selectedIssueType).secondary;
        }
        /*
        primaryIssueType: {
            value({resolve, lastSet, listenTo}) {
                function getParamValue(){
                    return new URL(window.location).searchParams.get("primaryIssueType") || "";
                }

                // anything happens in state, update the route 
                // the route updates, update the state (or the route if it's wrong)
                const resolveCurrentValue = (issueHierarchy, primaryIssueType) => {
                    
                    if(primaryIssueType === "Release") {
                        resolve(primaryIssueType);
                    } else if(this.issueHierarchy && this.issueHierarchy.length) {
                        if(primaryIssueType === "") {
                            resolve( this.issueHierarchy[0].name);
                        } 
                        // make sure it's still relevante
                        else if(this.issueHierarchy.some( issue => issue.name === primaryIssueType ) ) {
                            resolve(primaryIssueType);
                        } 
                        // set back to default
                        else {
                            setTimeout( ()=> {
                                updateUrlParam("primaryIssueType", "", "");
                            },1)
                        }
                    } else {
                        resolve(undefined);
                    }
                }


                // when the route changes, check stuff ...
                listenTo(pushStateObservable, ()=>{
                    resolveCurrentValue(this.issueHierarchy, getParamValue());
                })
                
                listenTo("issueHierarchy",({value})=> {
                    console.log("primaryIssueType / issueHierarchy", value, getParamValue())
                    resolveCurrentValue(value, getParamValue());
                });

                listenTo(lastSet, (value)=>{
                    updateUrlParam("primaryIssueType", value, "");
                });

                
                resolveCurrentValue(this.issueHierarchy, getParamValue());

            }
        },
        secondaryIssueType: {
            value({resolve, lastSet, listenTo}) {


                function getSecondaryValue(){
                    return new URL(window.location).searchParams.get("secondaryIssueType") || "";
                }

                function getPrimaryValue(){
                    return new URL(window.location).searchParams.get("primaryIssueType") || "";
                }

                const reconcileCurrentValue = (issueHierarchy, primaryIssueType, secondaryIssueType) => {
                    console.log("secondaryIssueType reconcile", {primaryIssueType, secondaryIssueType});
                    if(primaryIssueType && primaryIssueType === "Release") {
                        if(issueHierarchy && issueHierarchy.length) {
                            if(issueHierarchy.some( issue => issue.name === secondaryIssueType ) ) {
                                resolve(secondaryIssueType);
                            } else {
                                updateUrlParam("secondaryIssueType", "", "");
                            }
                        }
                    } else {
                        updateUrlParam("secondaryIssueType", "", "");
                    }

                }

                listenTo(pushStateObservable, ()=>{
                    reconcileCurrentValue(this.issueHierarchy, getPrimaryValue(), getSecondaryValue());
                })
                
                listenTo("issueHierarchy",({value})=> {
                    reconcileCurrentValue(this.issueHierarchy, getPrimaryValue(), getSecondaryValue());
                });
                listenTo("primaryIssueType",({value})=> {
                    reconcileCurrentValue(this.issueHierarchy, getPrimaryValue(), getSecondaryValue());
                });

                listenTo(lastSet, (value)=>{
                    setCurrentValue(value);
                });

    
                reconcileCurrentValue(this.issueHierarchy, getPrimaryValue(), getSecondaryValue());

                function setCurrentValue(value) {
                    console.log("URL secondaryIssueType", value);
                    updateUrlParam("secondaryIssueType", value || "", "");
                    //resolve(value)
                }

                
            }
        }*/
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
        if(secondaryType) {
            this.selectedIssueType = "Release-"+secondaryType;
        } else {
            this.selectedIssueType = primaryType;
        }
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

function toSelectedParts(value){
    if(value) {
        if(value.startsWith("Release-")) {
            return {primary: "Release", secondary: value.substring("Release-".length)}
        } else {
            return {primary: value}
        }
    } else {
        return undefined;
    }
}

/**
 * 
 * @param {Array<import("../../../jira/normalized/normalize.js").NormalizedIssue>} normalizedIssues 
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