import SimpleTooltip from "./shared/simple-tooltip.js";
export var DAY_IN_MS = 1000 * 60 * 60 * 24;
var TOOLTIP = new SimpleTooltip();
document.body.append(TOOLTIP);
var showingObject = null;
export var dateFormatter = new Intl.DateTimeFormat('en-US', { day: "numeric", month: "short" });
export function prettyDate(date) {
    return date ? dateFormatter.format(date) : "";
}
export function wasReleaseDate(release) {
    var current = release.due;
    var was = release.lastPeriod && release.lastPeriod.due;
    if (was && current - DAY_IN_MS > was) {
        return " (" + prettyDate(was) + ")";
    }
    else {
        return "";
    }
}
export function wasStartDate(release) {
    var current = release.start;
    var was = release.lastPeriod && release.lastPeriod.start;
    if (was && (current - DAY_IN_MS > was)) {
        return " (" + prettyDate(was) + ")";
    }
    else {
        return "";
    }
}
export function showTooltipContent(element, content) {
    TOOLTIP.belowElementInScrollingContainer(element, content);
    TOOLTIP.querySelector(".remove-button").onclick = function () {
        showingObject = null;
        TOOLTIP.leftElement();
    };
}
export function showTooltip(element, issue) {
    var _a;
    console.log(issue);
    if (showingObject === issue) {
        showingObject = null;
        TOOLTIP.leftElement();
        return;
    }
    showingObject = issue;
    var makePartDetails = function (dateData, partName) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
        return "<details class=\"border border-slate-200\">\n            <summary>\n                <span class=\"release_box_subtitle_key color-text-and-bg-".concat(dateData.status, "\">\n                &nbsp;").concat(partName, "\n                </span>\n                ").concat(dateData.status !== "unknown" ?
            "&nbsp;<span class=\"release_box_subtitle_value\">\n                        ".concat(prettyDate(dateData.start), "\n                        ").concat(wasStartDate(dateData), "\n                        </span><span>-</span>\n                        <span class=\"release_box_subtitle_value\">\n                        ").concat(prettyDate(dateData.due), "\n                        ").concat(wasReleaseDate(dateData), "\n                    </span>") : '', "\n            </summary>\n            <div class=\"flex gap-2 \">\n                <div class=\"bg-neutral-20\">\n                    <div>").concat(prettyDate(dateData.start), "</div>\n                    <div>\n                        <a href=\"").concat((_b = (_a = dateData === null || dateData === void 0 ? void 0 : dateData.startFrom) === null || _a === void 0 ? void 0 : _a.reference) === null || _b === void 0 ? void 0 : _b.url, "\" target=\"_blank\" class=\"link\">\n                            ").concat((_d = (_c = dateData === null || dateData === void 0 ? void 0 : dateData.startFrom) === null || _c === void 0 ? void 0 : _c.reference) === null || _d === void 0 ? void 0 : _d.Summary, "</a> </div>\n                    <div class=\"font-mono text-sm\">").concat((_e = dateData === null || dateData === void 0 ? void 0 : dateData.startFrom) === null || _e === void 0 ? void 0 : _e.message, "</div>\n                </div>\n                <div class=\"bg-neutral-20\">\n                    <div>").concat(prettyDate(dateData.due), "</div>\n                    <a href=\"").concat((_g = (_f = dateData === null || dateData === void 0 ? void 0 : dateData.dueTo) === null || _f === void 0 ? void 0 : _f.reference) === null || _g === void 0 ? void 0 : _g.url, "\" target=\"_blank\" class=\"link\">\n                        ").concat((_j = (_h = dateData === null || dateData === void 0 ? void 0 : dateData.dueTo) === null || _h === void 0 ? void 0 : _h.reference) === null || _j === void 0 ? void 0 : _j.Summary, "</a>\n                    <div class=\"font-mono text-sm\">").concat((_k = dateData === null || dateData === void 0 ? void 0 : dateData.dueTo) === null || _k === void 0 ? void 0 : _k.message, "</div>\n                </div>\n            </div>\n        </details>");
    };
    var make = function (issue, workPart) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
        var breakdownPart = issue.dateData[workPart];
        return "<div class=\"p-2\">\n            <div class=\"release_box_subtitle_wrapper\">\n                    <span class=\"release_box_subtitle_key color-text-and-bg-".concat(breakdownPart.status, "\">\n                        &nbsp;").concat(workPart.toUpperCase(), "&nbsp;\n                    </span>\n                    ").concat(issue[workPart + "Status"] !== "unknown" ?
            "<span class=\"release_box_subtitle_value\">\n                            ".concat(prettyDate(breakdownPart.start), "\n                            ").concat(wasStartDate(breakdownPart), "\n                            </span><span>-</span>\n                            <span class=\"release_box_subtitle_value\">\n                            ").concat(prettyDate(breakdownPart.due), "\n                            ").concat(wasReleaseDate(breakdownPart), "\n                        </span>") : '', "\n            </div>\n            ").concat(((_a = breakdownPart.statusData) === null || _a === void 0 ? void 0 : _a.warning) === true ?
            "<div class=\"color-bg-warning\">".concat(breakdownPart.statusData.message, "</div>") : "", "\n            ").concat(breakdownPart.status !== "unknown" ?
            "<p>Start: <a href=\"".concat((_c = (_b = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _b === void 0 ? void 0 : _b.reference) === null || _c === void 0 ? void 0 : _c.url, "\" target=\"_blank\" class=\"link\">\n                    ").concat((_e = (_d = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _d === void 0 ? void 0 : _d.reference) === null || _e === void 0 ? void 0 : _e.Summary, "</a>'s \n                    ").concat((_f = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.startFrom) === null || _f === void 0 ? void 0 : _f.message, "\n                </p>\n                <p>End: <a href=\"").concat((_h = (_g = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _g === void 0 ? void 0 : _g.reference) === null || _h === void 0 ? void 0 : _h.url, "\" target=\"_blank\" class=\"link\">\n                    ").concat((_k = (_j = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _j === void 0 ? void 0 : _j.reference) === null || _k === void 0 ? void 0 : _k.Summary, "</a>'s\n                    ").concat((_l = breakdownPart === null || breakdownPart === void 0 ? void 0 : breakdownPart.dueTo) === null || _l === void 0 ? void 0 : _l.message, "\n                </p>") :
            '', "\n            \n        </div>");
    };
    var DOM = document.createElement("div");
    if (issue.dateData) {
        var rollupData = issue.dateData.rollup;
        DOM.innerHTML = "\n        <div class='flex remove-button pointer' style=\"justify-content: space-between\">\n            <a class=\"".concat(issue.url ? "link" : "", " text-lg font-bold\"\n                href=\"").concat(issue.url || '', "\" target=\"_blank\">").concat(issue.Summary || issue.release, "</a>\n            <span>\u274C</span>\n        </div>\n        ").concat(/*issue.dateData.rollup*/ false ? makePartDetails(issue.dateData.rollup, "rollup") : "", "\n        ").concat(((_a = rollupData === null || rollupData === void 0 ? void 0 : rollupData.statusData) === null || _a === void 0 ? void 0 : _a.warning) === true ?
            "<div class=\"color-bg-warning\">".concat(rollupData.statusData.message, "</div>") : "", "\n        ").concat(issue.dateData.rollup ? make(issue, "rollup") : "", "\n        ").concat(issue.dateData.dev ? make(issue, "dev") : "", "\n        ").concat(issue.dateData.qa ? make(issue, "qa") : "", "\n        ").concat(issue.dateData.uat ? make(issue, "uat") : "", "\n        ");
    }
    else {
        // "Planning" epics might not have this data
        DOM.innerHTML = "\n        <div class='flex remove-button pointer gap-2' style=\"justify-content: space-between\">\n            <a class=\"".concat(issue.url ? "link" : "", " text-lg font-bold\"\n                href=\"").concat(issue.url || '', "\" target=\"_blank\">").concat(issue.Summary || issue.release, "</a>\n            <span>\u274C</span>\n        </div>");
    }
    showTooltipContent(element, DOM);
}
