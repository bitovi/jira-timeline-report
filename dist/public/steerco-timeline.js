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
// https://yumbrands.atlassian.net/issues/?filter=10897
import { StacheElement, type, ObservableObject, stache } from "./can.js";
import { getCalendarHtml, getQuarter, getQuartersAndMonths } from "./quarter-timeline.js";
import { howMuchHasDueDateMovedForwardChangedSince, DAY_IN_MS } from "./date-helpers.js";
var inQAStatus = { "QA": true, "In QA": true };
var inDevStatus = { "In Development": true, "Development": true };
var inPartnerReviewStatus = { "Partner Review": true };
var inDoneStatus = { "Done": true };
import SimpleTooltip from "./shared/simple-tooltip.js";
var TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);
var SteercoTimeline = /** @class */ (function (_super) {
    __extends(SteercoTimeline, _super);
    function SteercoTimeline() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(SteercoTimeline.prototype, "showGanttGrid", {
        get: function () {
            return this.breakOutTimings || !this.showReleasesInTimeline;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "showGanttReleases", {
        get: function () {
            return this.breakOutTimings && this.showReleasesInTimeline;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "gridRows", {
        get: function () {
            return this.initiatives ? this.initiatives.length : this.releases.length;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "hasQAEpic", {
        get: function () {
            if (this.initiatives) {
                return this.initiatives.some(function (initiative) { return initiative.dateData.qa.issues.length; });
            }
            else {
                return true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "hasUATEpic", {
        get: function () {
            if (this.initiatives) {
                return this.initiatives.some(function (initiative) { return initiative.dateData.uat.issues.length; });
            }
            else {
                return true;
            }
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "startAndEndDate", {
        get: function () {
            var startDate = new Date(new Date().getFullYear(), Math.floor(new Date().getMonth() / 3) * 3);
            var hasDate;
            if (this.releases && this.releases.length) {
                hasDate = this.releases.filter(function (r) { return r.dateData.rollup.due; });
            }
            else if (this.initiatives) {
                hasDate = this.initiatives.filter(function (r) { return r.dateData.rollup.due; });
            }
            else {
                debugger;
            }
            return { endDate: new Date(Math.max.apply(Math, hasDate.map(function (r) { return r.dateData.rollup.due; }))), startDate: startDate };
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "quartersAndMonths", {
        get: function () {
            var _a = this.startAndEndDate, startDate = _a.startDate, endDate = _a.endDate;
            return getQuartersAndMonths(startDate, endDate);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "calendarHTML", {
        //const {html, firstDay, lastDay}
        get: function () {
            return stache.safeString(this.calendarData.html);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(SteercoTimeline.prototype, "todayMarginLeft", {
        get: function () {
            var _a = this.calendarData, firstDay = _a.firstDay, lastDay = _a.lastDay;
            var totalTime = (lastDay - firstDay);
            return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
        },
        enumerable: false,
        configurable: true
    });
    SteercoTimeline.prototype.releaseGanttWithTimeline = function () {
        var _a = this.calendarData, firstDay = _a.firstDay, lastDay = _a.lastDay;
        var totalTime = (lastDay - firstDay);
        return this.releases.map(function (release, index) {
            var div = document.createElement("div");
            if (release.dateData.rollup.start && release.dateData.rollup.due) {
                var width = ((release.dateData.rollup.due - release.dateData.rollup.start) / totalTime);
                //div.style.top = (index * 20)+"px";
                div.style.width = (width * 100) + "%";
                div.style.marginLeft = ((release.dateData.rollup.start - firstDay) / totalTime * 100) + "%";
                div.className = "release_time "; //+this.releaseQaStatus(release);
                var dev = document.createElement("div");
                dev.className = "dev_time "; //+this.releaseDevStatus(release);
                var devWidth = ((release.dateData.dev.due - release.dateData.dev.start) / totalTime);
                dev.style.width = (devWidth / width * 100) + "%";
                div.appendChild(dev);
                var qa = document.createElement("div");
                qa.className = "qa_time "; //+this.releaseDevStatus(release);
                var qaWidth = ((release.dateData.qa.due - release.dateData.qa.start) / totalTime);
                qa.style.width = (qaWidth / width * 100) + "%";
                div.appendChild(qa);
                var uat = document.createElement("div");
                uat.className = "uat_time "; //+this.releaseUatStatus(release);
                var uatWidth = ((release.dateData.uat.due - release.dateData.uat.start) / totalTime);
                uat.style.width = (uatWidth / width * 100) + "%";
                div.appendChild(uat);
                div.appendChild(document.createTextNode(release.shortName));
            }
            return div;
        });
    };
    Object.defineProperty(SteercoTimeline.prototype, "releaseGantt", {
        get: function () {
            if (this.breakOutTimings) {
                return this.releaseGanttWithTimeline();
            }
            else {
                return this.releaseTimeline();
            }
        },
        enumerable: false,
        configurable: true
    });
    SteercoTimeline.prototype.prettyDate = function (date) {
        return date ? dateFormatter.format(date) : "";
    };
    SteercoTimeline.prototype.wasReleaseDate = function (release) {
        var current = release.due;
        var was = release.lastPeriod && release.lastPeriod.due;
        if (was && current - DAY_IN_MS > was) {
            return " (" + this.prettyDate(was) + ")";
        }
        else {
            return "";
        }
    };
    SteercoTimeline.prototype.wasStartDate = function (release) {
        var current = release.start;
        var was = release.lastPeriod && release.lastPeriod.start;
        if (was && (current - DAY_IN_MS > was)) {
            return " (" + this.prettyDate(was) + ")";
        }
        else {
            return "";
        }
    };
    SteercoTimeline.prototype.plus = function (first, second) {
        return first + second;
    };
    SteercoTimeline.prototype.lastRowBorder = function (index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : "";
    };
    SteercoTimeline.prototype.showTooltip = function (event, initiativeOrRelease) {
        var _this = this;
        var _a;
        // Better would be to do the rest with state .... but I'm being lazy
        console.log(initiativeOrRelease);
        if (this.showTooltipObject === initiativeOrRelease) {
            this.showTooltipObject = null;
            TOOLTIP.leftElement();
            return;
        }
        this.showTooltipObject = initiativeOrRelease;
        var make = function (initiativeOrRelease, workPart) {
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
            var breakdownPart = initiativeOrRelease.dateData[workPart];
            return "<div class=\"p-2\">\n\t\t\t\t\t<div class=\"release_box_subtitle_wrapper\">\n\t\t\t\t\t\t\t<span class=\"release_box_subtitle_key color-text-and-bg-".concat(breakdownPart.status, "\">\n\t\t\t\t\t\t\t\t&nbsp;").concat(workPart.toUpperCase(), "&nbsp;\n\t\t\t\t\t\t\t</span>\n\t\t\t\t\t\t\t").concat(initiativeOrRelease[workPart + "Status"] !== "unknown" ?
                "<span class=\"release_box_subtitle_value\">\n\t\t\t\t\t\t\t\t\t".concat(_this.prettyDate(breakdownPart.start), "\n\t\t\t\t\t\t\t\t\t").concat(_this.wasStartDate(breakdownPart), "\n\t\t\t\t\t\t\t\t\t</span><span>-</span>\n\t\t\t\t\t\t\t\t\t<span class=\"release_box_subtitle_value\">\n\t\t\t\t\t\t\t\t\t").concat(_this.prettyDate(breakdownPart.due), "\n\t\t\t\t\t\t\t\t\t").concat(_this.wasReleaseDate(breakdownPart), "\n\t\t\t\t\t\t\t\t</span>") : '', "\n\t\t\t\t\t</div>\n\t\t\t\t\t").concat(((_a = breakdownPart.statusData) === null || _a === void 0 ? void 0 : _a.warning) === true ?
                "<div class=\"color-bg-warning\">".concat(breakdownPart.statusData.message, "</div>") : "", "\n\t\t\t\t\t").concat(breakdownPart.status !== "unknown" ?
                "<p>Start: <a href=\"".concat((_c = (_b = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.url, "\">\n\t\t\t\t\t\t\t").concat((_e = (_d = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.Summary, "</a>'s \n\t\t\t\t\t\t\t").concat((_f = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _f === void 0 ? void 0 : _f.message, "\n\t\t\t\t\t\t</p>\n\t\t\t\t\t\t<p>End: <a href=\"").concat((_h = (_g = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.url, "\">\n\t\t\t\t\t\t\t").concat((_k = (_j = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.Summary, "</a>'s\n\t\t\t\t\t\t\t").concat((_l = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _l === void 0 ? void 0 : _l.message, "\n\t\t\t\t\t\t</p>") :
                '', "\n\t\t\t\t\t\n\t\t\t\t</div>");
        };
        var rollupData = initiativeOrRelease.dateData.rollup;
        TOOLTIP.enteredElement(event, "\n\t\t\t<div class='flex remove-button pointer' style=\"justify-content: space-between\">\n\t\t\t\t<a class=\"p-1 color-text-and-bg-".concat(rollupData.status, "\"\n\t\t\t\t\thref=\"").concat(initiativeOrRelease.url, "\">").concat(initiativeOrRelease.Summary || initiativeOrRelease.release, "</a>\n\t\t\t\t<span>\u274C</span>\n\t\t\t</div>\n\t\t\t").concat(((_a = rollupData === null || rollupData === void 0 ? void 0 : rollupData.statusData) === null || _a === void 0 ? void 0 : _a.warning) === true ?
            "<div class=\"color-bg-warning\">".concat(rollupData.statusData.message, "</div>") : "", "\n\t\t\t").concat(make(initiativeOrRelease, "dev"), "\n\t\t\t").concat(make(initiativeOrRelease, "qa"), "\n\t\t\t").concat(make(initiativeOrRelease, "uat"), "\n\t\t\t"));
        TOOLTIP.querySelector(".remove-button").onclick = function () {
            _this.showTooltipObject = null;
            TOOLTIP.leftElement();
        };
    };
    SteercoTimeline.view = "\n\n\t\t{{# if(showReleasesInTimeline) }}\n\t\t\n\t\t{{/ if }}\n\t\t\n\t";
    return SteercoTimeline;
}(StacheElement));
customElements.define("steerco-timeline", SteercoTimeline);
