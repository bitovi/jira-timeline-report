import { StacheElement, type, ObservableObject, ObservableArray, value, queues } from "../../../can.js";

import {updateUrlParam, pushStateObservable} from "../../routing/state-storage.js";
import { bitoviTrainingIssueData } from "../../../examples/bitovi-training.js";

import routeData from "../../routing/route-data.js";
import "../status-filter.js";

import SimpleTooltip from "../../ui/simple-tooltip/simple-tooltip";

import { DROPDOWN_LABEL } from "../../../shared/style-strings.js";
import { issueHierarchyFromNormalizedIssues, toSelectedParts } from "../../routing/data-utils.js";

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
            secondaryIssueType: this.routeData.secondaryIssueType
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
        routeData: {
          get default() { return routeData; }
        },
        get issueHierarchy(){
            return this.derivedIssues && this.derivedIssues.length ?
                issueHierarchyFromNormalizedIssues(this.derivedIssues) :
                this.simplifiedIssueHierarchy;
            
        },
        get primaryIssueType() {
            return this.routeData.selectedIssueType && toSelectedParts(this.routeData.selectedIssueType).primary;
        },
        get secondaryIssueType() {
            return this.routeData.selectedIssueType && toSelectedParts(this.routeData.selectedIssueType).secondary;
        }


    };
    onSelection(primaryType, secondaryType){
        if(secondaryType) {
            this.routeData.selectedIssueType = "Release-"+secondaryType;
        } else {
            this.routeData.selectedIssueType = primaryType;
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


customElements.define("select-issue-type", SelectIssueType);
