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
import { rollupDatesFromRollups } from "./prepare-issues/date-data.js";
import { getQuartersAndMonths } from "./quarter-timeline.js";
import { getCalendarHtml } from "./quarter-timeline.js";
var DAY = 1000 * 60 * 60 * 24;
var GanttTimeline = /** @class */ (function (_super) {
    __extends(GanttTimeline, _super);
    function GanttTimeline() {
        return _super !== null && _super.apply(this, arguments) || this;
    }
    Object.defineProperty(GanttTimeline.prototype, "quartersAndMonths", {
        get: function () {
            // handle if there are no issues
            var endDates = this.issues.map(function (issue) {
                return { dateData: { rollup: {
                            start: issue.dateData.rollup.due,
                            startFrom: issue.dateData.rollup.dueTo,
                            due: issue.dateData.rollup.due,
                            dueTo: issue.dateData.rollup.dueTo
                        } } };
            });
            var _a = rollupDatesFromRollups(endDates), start = _a.start, due = _a.due;
            var firstEndDate = new Date((start || new Date()).getTime() - DAY * 30);
            return getQuartersAndMonths(firstEndDate, due || new Date(new Date().getTime() + DAY * 30));
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttTimeline.prototype, "todayMarginLeft", {
        get: function () {
            var _a = this.quartersAndMonths, firstDay = _a.firstDay, lastDay = _a.lastDay;
            var totalTime = (lastDay - firstDay);
            return (new Date() - firstDay - 1000 * 60 * 60 * 24 * 2) / totalTime * 100;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttTimeline.prototype, "calendarData", {
        get: function () {
            var _a = rollupDatesFromRollups(this.issues), start = _a.start, due = _a.due;
            return getCalendarHtml(new Date(), due);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttTimeline.prototype, "calendarHTML", {
        get: function () {
            return stache.safeString(this.calendarData.html);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(GanttTimeline.prototype, "rows", {
        get: function () {
            var _a = this.quartersAndMonths, firstDay = _a.firstDay, lastDay = _a.lastDay;
            var totalTime = (lastDay - firstDay);
            var rows = calculate({
                issues: this.issues,
                firstDay: firstDay,
                totalTime: totalTime,
                makeElementForIssue: function (release) {
                    var div = document.createElement("div");
                    div.className = " release-timeline-item flex items-center gap-1";
                    Object.assign(div.style, {
                        position: "absolute",
                        //transform: "translate(-100%, 0)",
                        padding: "2px 4px 2px 4px",
                        zIndex: "100",
                        top: "4px",
                        background: "rgba(255,255,255, 0.6)"
                    });
                    var text = document.createElement("div");
                    text.className = "truncate";
                    Object.assign(text.style, {
                        position: "relative",
                        zIndex: "10",
                        maxWidth: "300px"
                    });
                    text.appendChild(document.createTextNode(release.shortVersion || release.Summary));
                    div.appendChild(text);
                    var tick = document.createElement("div");
                    tick.className = "color-text-and-bg-" + release.dateData.rollup.status;
                    Object.assign(tick.style, {
                        height: "10px",
                        width: "10px",
                        transform: "rotate(45deg)",
                    });
                    div.appendChild(tick);
                    return div;
                }
            });
            for (var _i = 0, rows_1 = rows; _i < rows_1.length; _i++) {
                var row = rows_1[_i];
                for (var _b = 0, _c = row.items; _b < _c.length; _b++) {
                    var item = _c[_b];
                    item.element.style.right = ((totalTime - (item.issue.dateData.rollup.due - firstDay)) / totalTime * 100) + "%";
                }
            }
            return rows;
        },
        enumerable: false,
        configurable: true
    });
    GanttTimeline.prototype.plus = function (first, second) {
        return first + second;
    };
    GanttTimeline.prototype.lastRowBorder = function (index) {
        return index === this.quartersAndMonths.months.length - 1 ? "border-r-solid-1px-slate-900" : "";
    };
    GanttTimeline.view = "\n        <div style=\"display: grid; grid-template-columns: repeat({{this.quartersAndMonths.months.length}}, auto); grid-template-rows: auto auto repeat({{this.rows.length}}, auto)\"\n        class='p-2 mb-10'>\n\n            {{# for(quarter of this.quartersAndMonths.quarters) }}\n                <div style=\"grid-column: span 3\" class=\"text-center\">{{quarter.name}}</div>\n            {{ / for }}\n\n            {{# for(month of this.quartersAndMonths.months)}}\n                <div \n                    style=\"grid-column: {{ plus(scope.index, 1) }} / span 1; grid-row: 2 / span 1;\"\n                    class='border-b border-neutral-80 text-center'>{{month.name}}</div>\n            {{/ for }}\n\n            <!-- CURRENT TIME BOX -->\n            <div style=\"grid-column: 1 / span {{this.quartersAndMonths.months.length}}; grid-row: 2 / span {{plus(this.rows.length, 1)}};\">\n                <div class='today' style=\"margin-left: {{this.todayMarginLeft}}%; width: 1px; background-color: orange; z-index: 0; position: relative; height: 100%;\"></div>\n            </div>\n\n            <!-- VERTICAL COLUMNS -->\n            {{# for(month of this.quartersAndMonths.months)}}\n                <div style=\"grid-column: {{ plus(scope.index, 1) }} / span 1; grid-row: 3 / span {{this.rows.length}}; z-index: 10\"\n                    class='border-l border-b border-neutral-80 {{this.lastRowBorder(scope.index)}}'></div>\n            {{/ for }}\n\n            \n            {{# for(row of this.rows) }}\n            <div class=\"h-10 relative\" style=\"grid-column: 1 / span {{this.quartersAndMonths.months.length}}; grid-row: {{plus(scope.index, 3)}} / span 1;\">\n                {{# for(item of row.items) }}\n                    {{{item.element}}}\n                {{/ for }}\n            </div>\n            {{/ for }}\n\n            \n        </div>\n    ";
    return GanttTimeline;
}(StacheElement));
export { GanttTimeline };
function defaultGetWidth(element) {
    var clone = element.cloneNode(true);
    var outer = document.createElement("div");
    outer.appendChild(clone);
    Object.assign(outer.style, {
        position: "absolute",
        top: "-1000px",
        left: "-1000px",
        width: "700px",
        visibility: 'hidden'
    });
    document.body.appendChild(outer);
    var width = clone.getBoundingClientRect().width;
    document.body.removeChild(outer);
    return width;
}
function calculate(_a) {
    var _b = _a.widthOfArea, widthOfArea = _b === void 0 ? 1230 : _b, issues = _a.issues, makeElementForIssue = _a.makeElementForIssue, firstDay = _a.firstDay, totalTime = _a.totalTime, _c = _a.getWidth, getWidth = _c === void 0 ? defaultGetWidth : _c;
    var rows = [];
    var issueUIData = issues.map(function (issue) {
        var element = makeElementForIssue(issue), width = getWidth(element), widthInPercent = width * 100 / widthOfArea, rightPercentEnd = Math.ceil((issue.dateData.rollup.due - firstDay) / totalTime * 100), leftPercentStart = rightPercentEnd - widthInPercent;
        element.setAttribute("measured-width", width);
        element.setAttribute("left-p", leftPercentStart);
        element.setAttribute("right-p", leftPercentStart);
        return {
            issue: issue,
            element: element,
            widthInPercent: widthInPercent,
            leftPercentStart: leftPercentStart,
            rightPercentEnd: rightPercentEnd
        };
    });
    // earliest first
    issueUIData.sort(function (a, b) {
        return a.leftPercentStart - b.leftPercentStart;
    });
    function addToRow(issueUIDatum) {
        for (var _i = 0, rows_2 = rows; _i < rows_2.length; _i++) {
            var row = rows_2[_i];
            // if we have no intersections, we can insert
            var intersected = row.items.some(function (item) {
                return intersect({ start: item.leftPercentStart, end: item.rightPercentEnd }, { start: issueUIDatum.leftPercentStart, end: issueUIDatum.rightPercentEnd });
            });
            if (!intersected) {
                row.items.push(issueUIDatum);
                return;
            }
        }
        // we didn't find space, add a raw
        rows.push({
            items: [issueUIDatum]
        });
    }
    issueUIData.forEach(addToRow);
    return rows;
}
function intersect(range1, range2) {
    return range1.start < range2.end && range2.start < range1.end;
}
customElements.define("gantt-timeline", GanttTimeline);
