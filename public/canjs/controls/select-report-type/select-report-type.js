import { StacheElement } from "../../../can.js";
import { DROPDOWN_LABEL } from "../../../shared/style-strings.js";

import routeData from "../../routing/route-data";

import "../status-filter.js";

const booleanParsing = {
  parse: (x) => {
    return { "": true, true: true, false: false }[x];
  },
  stringify: (x) => "" + x,
};

const selectStyle =
  "bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

import SimpleTooltip from "../../ui/simple-tooltip/simple-tooltip";
const TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);

const hoverEffect = "hover:bg-neutral-301 cursor-pointer";

class ReportSelectionDropdown extends StacheElement {
  static view = `
         {{# for(report of this.reportTypes) }}
            <label class="px-4 py-2 block {{#eq(this.routeData.primaryReportType, report.key)}}bg-blue-101{{else}}${hoverEffect}{{/eq}}"><input 
                type="radio" 
                name="primaryReportType" 
                checked:from="eq(this.routeData.primaryReportType, report.key)"
                on:change="this.onSelection(report.key)"/> {{report.name}} </label>
        {{/ }}
    `;

  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },
    onSelection: Function,
    get reportTypes() {
      return this.routeData.reports.filter((report) => {
        return (
          (this.features?.groupGrid || report.key !== "group-grid") &&
          (this.features?.estimationTable || report.key !== "table")
        );
      });
    },
  };
}

customElements.define("report-selection-dropdown", ReportSelectionDropdown);

export class SelectReportType extends StacheElement {
  static view = `
        <label for="reportType" class="${DROPDOWN_LABEL}">Report type</label>
        {{# not(this.routeData.primaryReportType) }}
            ---
        {{/ }}
        {{# if(this.routeData.primaryReportType) }}
            <button 
                class="rounded bg-neutral-201 px-3 py-1 ${hoverEffect}"
                id="reportType"
                on:click="this.showChildOptions()">{{this.primaryReportName}} <img class="inline" src="/images/chevron-down.svg"/></button>
        {{/ }}
    `;
  static props = {
    routeData: {
      get default() {
        return routeData;
      },
    },
    get primaryReportName() {
      return this.routeData.reports.find(
        (report) => report.key === this.routeData.primaryReportType
      ).name;
    },
  };

  showChildOptions() {
    let dropdown = new ReportSelectionDropdown().initialize({
      onSelection: this.onSelection.bind(this),
      features: this.features,
    });

    TOOLTIP.belowElementInScrollingContainer(this, dropdown);
  }
  onSelection(reportType) {
    this.routeData.primaryReportType = reportType;
    TOOLTIP.leftElement();
  }
  connected() {
    this.listenTo(window, "click", (event) => {
      if (!TOOLTIP.contains(event.target)) {
        TOOLTIP.leftElement();
      }
    });
  }
}

customElements.define("select-report-type", SelectReportType);
