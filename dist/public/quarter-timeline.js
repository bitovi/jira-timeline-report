function monthDiff(dateFromSring, dateToString) {
    var dateFrom = new Date(dateFromSring);
    var dateTo = new Date(dateToString);
    return dateTo.getMonth() - dateFrom.getMonth() + 12 * (dateTo.getFullYear() - dateFrom.getFullYear());
}
export function getQuartersAndMonths(startDate, endDate) {
    // figure out which quarters startDate and endDate are within
    var quarterStartDate = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3);
    var lastQuarterEndDate = new Date(endDate.getFullYear(), Math.floor(endDate.getMonth() / 3) * 3 + 3);
    var result = '';
    // Html monthly block to make 1 quater
    var accumulatedCalendarQuaterHtml = '';
    // if quater change we will create a new HTML block
    var previousQuater = null;
    // keep track of release indexes
    var monthDiffResult = monthDiff(quarterStartDate, lastQuarterEndDate);
    var quarters = monthDiffResult / 3;
    if (!Number.isInteger(quarters)) {
        console.warn("Not an even number of quarters", monthDiffResult, "/ 3");
    }
    function month(d) {
        return d.toLocaleString('default', { month: 'short' });
    }
    var quartersList = [];
    var months = [];
    for (var i = 0; i < quarters; i++) {
        var firstMonth = new Date(quarterStartDate);
        firstMonth.setMonth(firstMonth.getMonth() + i * 3);
        var secondMonth = new Date(quarterStartDate);
        secondMonth.setMonth(secondMonth.getMonth() + i * 3 + 1);
        var thirdMonth = new Date(quarterStartDate);
        thirdMonth.setMonth(thirdMonth.getMonth() + +i * 3 + 2);
        quartersList.push({
            number: Math.floor(firstMonth.getMonth() / 3) + 1,
            name: "Q" + (Math.floor(firstMonth.getMonth() / 3) + 1)
        });
        months.push({
            first: true,
            name: month(firstMonth)
        });
        months.push({
            name: month(secondMonth)
        });
        months.push({
            last: true,
            name: month(thirdMonth)
        });
    }
    var lastDay = new Date(quarterStartDate);
    lastDay.setMonth(lastDay.getMonth() + monthDiffResult);
    return {
        quarters: quartersList,
        months: months,
        firstDay: quarterStartDate,
        lastDay: lastDay
    };
}
export function getCalendarHtml(startDate, endDate) {
    // figure out which quarters startDate and endDate are within
    var quarterStartDate = new Date(startDate.getFullYear(), Math.floor(startDate.getMonth() / 3) * 3);
    var lastQuarterEndDate = new Date(endDate.getFullYear(), Math.floor(endDate.getMonth() / 3) * 3 + 3);
    var result = '';
    // Html monthly block to make 1 quater
    var accumulatedCalendarQuaterHtml = '';
    // if quater change we will create a new HTML block
    var previousQuater = null;
    // keep track of release indexes
    var monthDiffResult = monthDiff(quarterStartDate, lastQuarterEndDate);
    var quarters = monthDiffResult / 3;
    if (!Number.isInteger(quarters)) {
        console.warn("Not an even number of quarters", monthDiffResult, "/ 3");
    }
    function month(d) {
        return d.toLocaleString('default', { month: 'short' });
    }
    for (var i = 0; i < quarters; i++) {
        var firstMonth = new Date(quarterStartDate);
        firstMonth.setMonth(firstMonth.getMonth() + i * 3);
        var secondMonth = new Date(quarterStartDate);
        secondMonth.setMonth(secondMonth.getMonth() + i * 3 + 1);
        var thirdMonth = new Date(quarterStartDate);
        thirdMonth.setMonth(thirdMonth.getMonth() + +i * 3 + 2);
        result += "\n\t\t\t<div class=\"calendar\">\n\t\t\t\t<div class=\"calendar_title\">Q".concat(Math.floor(firstMonth.getMonth() / 3) + 1, "</div>\n\t\t\t\t<div class=\"calendar_month_wrapper\">\n\t\t\t\t\t<div class=\"calendar_month \">\n\t\t\t\t\t\t<span class=\"calendar_month_name\">").concat(month(firstMonth), "</span>\n\t\t\t\t\t\t<span class=\"calendar_month_line\"></span>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"calendar_month dotted-left\">\n\t\t\t\t\t\t<span class=\"calendar_month_name\">").concat(month(secondMonth), "</span>\n\t\t\t\t\t\t<span class=\"calendar_month_line\"></span>\n\t\t\t\t\t</div>\n\t\t\t\t\t<div class=\"calendar_month dotted-left\">\n\t\t\t\t\t\t<span class=\"calendar_month_name\">").concat(month(thirdMonth), "</span>\n\t\t\t\t\t\t<span class=\"calendar_month_line\"></span>\n\t\t\t\t\t</div>\n\t\t\t\t</div>\n\t\t\t</div>\n\t\t");
    }
    var lastDay = new Date(startDate);
    lastDay.setMonth(lastDay.getMonth() + monthDiffResult);
    return {
        html: result,
        firstDay: quarterStartDate,
        lastDay: lastDay
    };
}
function getPreviousQuaterAndYear(newDate) {
    var previousQuater = getQuarter(newDate);
    -1;
    return previousQuater === 0
        ? { quater: 4, year: newDate.getFullYear() - 1 }
        : { quater: previousQuater, year: newDate.getFullYear() };
}
export function getQuarter(date) {
    if (date === void 0) { date = new Date(); }
    return Math.floor(date.getMonth() / 3 + 1);
}
