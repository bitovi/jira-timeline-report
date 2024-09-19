var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __read = (this && this.__read) || function (o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m) return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
    }
    catch (error) { e = { error: error }; }
    finally {
        try {
            if (r && !r.done && (m = i["return"])) m.call(i);
        }
        finally { if (e) throw e.error; }
    }
    return ar;
};
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
var __values = (this && this.__values) || function(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m) return m.call(o);
    if (o && typeof o.length === "number") return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
};
var START_DATE_KEY = "Start date";
var DUE_DATE_KEY = "Due date";
// ! I'm not sure why changelog has both Start Date and duedate.
export function howMuchHasDueDateMovedForwardChangedSince(epic, checkpointDate) {
    var e_1, _a;
    var dueDateWasPriorToTheFirstChangeAfterTheCheckpoint;
    var dueDateNow;
    var currentDate;
    try {
        // find the due date at "date"
        for (var _b = __values(__spreadArray([], __read(epic.changelog), false).reverse()), _c = _b.next(); !_c.done; _c = _b.next()) {
            var changelog = _c.value;
            var createdDate = new Date(changelog.created);
            var dueDateSetItem = changelog.items.find(function (item) { return item.field === "duedate"; });
            if (dueDateSetItem) {
                var fromDate = dueDateSetItem.from && new Date(dueDateSetItem.from);
                var toDate = dueDateSetItem.to && new Date(dueDateSetItem.to);
                // if this change was after "checkpoint", take "from"
                // if this change was before "checkpoint", take "to"
                currentDate = toDate;
                // we just moved the time after checkpointDate
                if ((createdDate > checkpointDate) && !dueDateWasPriorToTheFirstChangeAfterTheCheckpoint && fromDate) {
                    dueDateWasPriorToTheFirstChangeAfterTheCheckpoint = fromDate;
                }
            }
        }
    }
    catch (e_1_1) { e_1 = { error: e_1_1 }; }
    finally {
        try {
            if (_c && !_c.done && (_a = _b.return)) _a.call(_b);
        }
        finally { if (e_1) throw e_1.error; }
    }
    if (!currentDate) {
        currentDate = new Date(epic["Due date"]);
    }
    if (!dueDateWasPriorToTheFirstChangeAfterTheCheckpoint) {
        dueDateWasPriorToTheFirstChangeAfterTheCheckpoint = currentDate;
    }
    return {
        currentDate: currentDate,
        dateHasMovedForward: currentDate - DAY_IN_MS * 1 > dueDateWasPriorToTheFirstChangeAfterTheCheckpoint,
        dateHasChanged: dueDateWasPriorToTheFirstChangeAfterTheCheckpoint !== currentDate,
        dueDateWasPriorToTheFirstChangeAfterTheCheckpoint: dueDateWasPriorToTheFirstChangeAfterTheCheckpoint,
        daysChanged: Math.round((currentDate - dueDateWasPriorToTheFirstChangeAfterTheCheckpoint) / DAY_IN_MS)
    };
}
// Formats this takes on:
// 2023-02-17T16:58:00.000Z
// 2024-04-19T16:43:17.181-0400
// new Date("2024-05-27") -> date in GMT 0, not in the local timezone. This can mean reporting the wrong date.
export function parseDateISOString(s) {
    if (!s)
        return s;
    // if this is a date already, assume we need to correct timezone
    if (s instanceof Date) {
        // fix timezone to UTC
        return new Date(s.getTime() + s.getTimezoneOffset() * 60 * 1000);
    }
    if (s.split(/\D/).length === 3) {
        throw new Error("Unable to parse " + s);
    }
    return new Date(s);
}
export function parseDateIntoLocalTimezone(s) {
    if (!s) {
        return s;
    }
    var ds = s.split(/\D/).map(function (s) { return parseInt(s); });
    ds[1] = ds[1] - 1; // adjust month
    return new (Date.bind.apply(Date, __spreadArray([void 0], __read(ds), false)))();
}
/**
 * Parse an 8601 date string `YYYY-MM-DD` into a date.
 * @export
 * @param {string} str
 * @returns {Date}
 */
export function parseDate8601String(str) {
    if (str) {
        debugger;
    }
    // This should just work, we can get fancy later and use date-fns or something.
    return str ? new Date(str) : str;
}
export var DAY_IN_MS = 1000 * 60 * 60 * 24;
/**
 * @export
 * @param {number} durationMS Duration in milliseconds.
 * @param {(number) => number} [toInteger] A Math function to round to an integer. Defaults to `round`.
 * @returns {number} milliseconds converted to full days.
 */
export function millisecondsToDay(durationMS, toInteger) {
    if (toInteger === void 0) { toInteger = Math.round; }
    return toInteger(durationMS / DAY_IN_MS);
}
export function sortByStartDate(issues) {
    return issues.sort(function (issueA, issueB) {
        var dateA = issueA.start, dateB = issueB.start;
        return dateA - dateB;
    });
}
export function getLastDateFrom(initiatives, property) {
    var values = initiatives.filter(function (init) { return init[property]; }).map(function (init) { return parseDateISOString(init[property]); })
        .filter(function (number) { return !isNaN(number); });
    return values.length ? new Date(Math.max.apply(Math, __spreadArray([], __read(values), false))) : undefined;
}
export function getDateFromLastPeriod(initiatives, lowercasePhase, checkpoint) {
    var dates = initiatives.map(function (initiative) {
        if (initiative[lowercasePhase]) {
            var dueDateWasPriorToTheFirstChangeAfterTheCheckpoint = howMuchHasDueDateMovedForwardChangedSince(initiative[lowercasePhase], checkpoint).dueDateWasPriorToTheFirstChangeAfterTheCheckpoint;
            return dueDateWasPriorToTheFirstChangeAfterTheCheckpoint;
        }
    }).filter(function (d) { return d; }); // remove undefineds
    var date = Math.max.apply(Math, __spreadArray([], __read(dates), false));
    return new Date(date);
}
// This is a collection of children's timing ...
export function epicTimingData(epics) {
    var sorted = sortByStartDate(epics);
    // const due = endDateFromList(sorted)
    // ,dueLastPeriod = endDateFromList(sorted, "dueLastPeriod");
    return __assign(__assign(__assign(__assign({ issues: sorted }, endDateDataFromList(sorted)), firstDateDataFromList(sorted)), endDateDataFromList(sorted)), { 
        //dueLastPeriod: endDateFromList(sorted, "dueLastPeriod"),
        workingBusinessDays: epics.reduce(function (acc, cur) {
            return acc + (cur.workingBusinessDays || 0);
        }, 0), weightedEstimate: epics.reduce(function (acc, cur) {
            return acc + (cur.weightedEstimate || 0);
        }, 0) });
}
function endDateDataFromList(issues) {
    var maxDate = -Infinity, maxIndex;
    for (var i = 0; i < issues.length; i++) {
        var dueNumber = +issues[i].due;
        if (!isNaN(dueNumber) && dueNumber > 0 && dueNumber > maxDate) {
            maxDate = dueNumber;
            maxIndex = i;
        }
    }
    return maxIndex >= 0 ? { due: new Date(issues[maxIndex].due), dueTo: issues[maxIndex].dueTo } : {};
}
function firstDateDataFromList(issues) {
    var minDate = Infinity, minIndex;
    for (var i = 0; i < issues.length; i++) {
        var startNumber = +issues[i].start;
        if (!isNaN(startNumber) && startNumber > 0 && startNumber < minDate) {
            minDate = startNumber;
            minIndex = i;
        }
    }
    return minIndex >= 0 ? { start: new Date(issues[minIndex].start), startFrom: issues[minIndex].startFrom } : {};
}
export function getFirstDateFrom(initiatives, property) {
    var values = initiatives.filter(function (init) { var _a; return (_a = init[property]) === null || _a === void 0 ? void 0 : _a[START_DATE_KEY]; }).map(function (init) { return parseDateISOString(init[property][START_DATE_KEY]); });
    return values.length ? new Date(Math.min.apply(Math, __spreadArray([], __read(values), false))) : undefined;
}
