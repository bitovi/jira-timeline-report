import { StacheElement, type, ObservableObject, ObservableArray, value } from "../can.js";

import {saveJSONToUrl,updateUrlParam} from "../shared/state-storage.js";
import { calculationKeysToNames, allTimingCalculationOptions, getImpliedTimingCalculations } from "../prepare-issues/date-data.js";

import { allStatusesSorted, allReleasesSorted } from "../jira/normalized/normalize.js";

import "../status-filter.js";

const booleanParsing = {
    parse: x => {
      return ({"": true, "true": true, "false": false})[x];
    },
    stringify: x => ""+x
  };


const selectStyle = "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"

import SimpleTooltip from "../shared/simple-tooltip.js";
const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

const REPORTS = [{
    key: "start-due",
    name: "Start and due dates"
},{
    key: "due",
    name: "Due dates only"
}];

const hoverEffect = "hover:bg-neutral-301 cursor-pointer";

class ReportSelectionDropdown extends StacheElement {
    static view = `
         {{# for(report of this.reports) }}
            <label class="px-4 py-2 block {{#eq(this.primaryReportType, report.key)}}bg-blue-101{{else}}${hoverEffect}{{/eq}}"><input 
                type="radio" 
                name="primaryReportType" 
                checked:from="eq(this.primaryReportType, report.key)"
                on:change="this.onSelection(report.key)"/> {{report.name}} </label>
        {{/ }}
    `
}

customElements.define("report-selection-dropdown", ReportSelectionDropdown);



export class SelectReportType extends StacheElement {
    static view = `
        {{# not(this.primaryReportType) }}
            ---
        {{/ }}
        {{# if(this.primaryReportType) }}
            <button 
                class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}"
                on:click="this.showChildOptions()">{{this.primaryReportName}} <img class="inline" src="/images/chevron-down.svg"/></button>
        {{/ }}
    `;
    static props ={
        primaryReportType: saveJSONToUrl("primaryReportType", "start-due", String, {parse: x => ""+x, stringify: x => ""+x}),
        reports: {
            get default(){
                return REPORTS;
            }
        },
        get primaryReportName(){
            return this.reports.find( report => report.key === this.primaryReportType).name;
        }
    };

    showChildOptions(){
        let dropdown = new ReportSelectionDropdown().initialize({
            primaryReportType: this.primaryReportType,
            reports: this.reports,
            onSelection: this.onSelection.bind(this)
        })

        TOOLTIP.belowElementInScrollingContainer(this, dropdown);
    }
    onSelection(reportType) {
        this.primaryReportType = reportType;
    }
    connected(){
        this.listenTo(window, "click", (event)=>{
          if(!TOOLTIP.contains(event.target))   {
            TOOLTIP.leftElement();
          }
        })
    }
}


customElements.define("select-report-type", SelectReportType);