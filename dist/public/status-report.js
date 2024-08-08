var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
import { StacheElement, type, ObservableObject, stache } from "./can.js";
import { dateFormatter } from "./issue-tooltip.js";
import { DAY_IN_MS } from "./date-helpers.js";
import { showTooltip } from "./issue-tooltip.js";
var release_box_subtitle_wrapper = "flex gap-2 text-neutral-800 text-sm";
var StatusReport = /** @class */ (function (_super) {
    __extends(StatusReport, _super);
    function StatusReport() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(StatusReport.prototype, "columnDensity", {
        get: function () {
            if (this.primaryIssues.length > 20) {
                return "absurd";
            }
            else if (this.primaryIssues.length > 10) {
                return "high";
            }
            else if (this.primaryIssues.length > 4) {
                return "medium";
            }
            else {
                return "light";
            }
        },
        enumerable: false,
        configurable: true
    });
    StatusReport.prototype.prettyDate = function (date) {
        return date ? dateFormatter.format(date) : "";
    };
    StatusReport.prototype.wasReleaseDate = function (release) {
        var current = release.due;
        var was = release.lastPeriod && release.lastPeriod.due;
        if (was && current - DAY_IN_MS > was) {
            return " (" + this.prettyDate(was) + ")";
        }
        else {
            return "";
        }
    };
    StatusReport.prototype.wasStartDate = function (release) {
        var current = release.start;
        var was = release.lastPeriod && release.lastPeriod.start;
        if (was && (current - DAY_IN_MS > was)) {
            return " (" + this.prettyDate(was) + ")";
        }
        else {
            return "";
        }
    };
    StatusReport.prototype.showTooltip = function (event, isssue) {
        showTooltip(event.currentTarget, isssue);
    };
    StatusReport.prototype.fontSize = function (count) {
        if (["high", "absurd"].includes(this.columnDensity)) {
            return "text-xs";
        }
        if (count >= 7 && this.columnDensity === "medium") {
            return "text-sm";
        }
        else if (count <= 4) {
            return "text-base";
        }
    };
    StatusReport.view = "\n    <div class='release_wrapper {{# if(this.breakdown) }}extra-timings{{else}}simple-timings{{/ if}} px-2 flex gap-2'>\n        {{# for(primaryIssue of this.primaryIssues) }}\n            <div class='release_box grow'>\n                <div \n                    on:click='this.showTooltip(scope.event, primaryIssue)'\n                    class=\"pointer release_box_header_bubble color-text-and-bg-{{primaryIssue.dateData.rollup.status}} rounded-t {{this.fontSize(0)}}\">\n                        {{primaryIssue.Summary}}\n                    </div>\n                \n                    {{# if(this.breakdown) }}\n\n                            <div class=\"".concat(release_box_subtitle_wrapper, " pt-1\">\n                                    <span class=\"release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.dev.status}} font-mono px-px\">Dev</span>\n                                    <span class=\"release_box_subtitle_value\">\n                                        {{ this.prettyDate(primaryIssue.dateData.dev.due) }}{{this.wasReleaseDate(primaryIssue.dateData.dev) }}\n                                    </span>\n                            </div>\n                            <div class=\"").concat(release_box_subtitle_wrapper, "\">\n                                    <span class=\"release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.qa.status}} font-mono px-px\">QA&nbsp;</span>\n                                    <span class=\"release_box_subtitle_value\">\n                                        {{ this.prettyDate(primaryIssue.dateData.qa.due) }}{{ this.wasReleaseDate(primaryIssue.dateData.qa) }}\n                                    </span>\n                            </div>\n                            <div class=\"").concat(release_box_subtitle_wrapper, "\">\n                                    <span class=\"release_box_subtitle_key color-text-and-bg-{{primaryIssue.dateData.uat.status}} font-mono px-px\">UAT</span>\n                                    <span class=\"release_box_subtitle_value\">\n                                        {{ this.prettyDate(primaryIssue.dateData.uat.due) }}{{ this.wasReleaseDate(primaryIssue.dateData.uat) }}\n                                    </span>\n                            </div>\n                    {{ else }}\n                        <div class=\"").concat(release_box_subtitle_wrapper, " p-1\">\n                                <b>Target Delivery</b>\n                                <span class=\"release_box_subtitle_value\">\n                                    <span class=\"nowrap\">{{ this.prettyDate(primaryIssue.dateData.rollup.due) }}</span>\n                                    <span class=\"nowrap\">{{ this.wasReleaseDate(primaryIssue.dateData.rollup) }}</span>\n                                </span>\n                        </div>\n                    {{/ if }}\n\n                <ul class=\" {{# if(this.breakdown) }}list-none{{else}}list-disc list-inside p-1{{/if}}\">\n                    {{# for(secondaryIssue of primaryIssue.dateData.children.issues) }}\n                    <li class='font-sans {{this.fontSize(primaryIssue.dateData.children.issues.length)}} pointer' on:click='this.showTooltip(scope.event, secondaryIssue)'>\n                        {{# if(this.breakdown) }}\n                        <span class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.dev.status}}'>D</span><span\n                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.qa.status}}'>Q</span><span\n                            class='text-xs font-mono px-px py-0 color-text-and-bg-{{secondaryIssue.dateData.uat.status}}'>U</span>\n                        {{/ if }}\n                        <span class=\"{{# if(this.breakdown) }} color-text-black{{else}} color-text-{{secondaryIssue.dateData.rollup.status}} {{/ }}\">{{secondaryIssue.Summary}}</span>\n                    </li>\n                    {{/ for}}\n                </ul>\n            </div>\n        {{ else }}\n        <div class='release_box'>\n            <div class=\"release_box_header_bubble\">\n                Unable to find any issues.\n            </div>\n        </div>\n        {{/ for }}\n        {{# if(this.planningIssues.length) }}\n            <div class='release_box grow'>\n                <div class=\"release_box_header_bubble color-text-and-bg-unknown rounded-t\">Planning</div>\n                <ul class=\"list-disc list-inside p-1\">\n                {{# for(planningIssue of this.planningIssues)}}\n                    <li class='font-sans {{this.fontSize(this.planningIssues.length)}} color-text-unknown pointer'\n                         on:click='this.showTooltip(scope.event, planningIssue)'>\n                        {{planningIssue.Summary}}\n                    </li>\n\n                {{/}}\n                </ul>\n            </div>\n        {{/ }}\n        \n    </div>\n    ");
    return StatusReport;
}(StacheElement));
export { StatusReport };
customElements.define("status-report", StatusReport);
