const START_DATE_KEY = "Start date";
const DUE_DATE_KEY = "Due date";

// ! I'm not sure why changelog has both Start Date and duedate.
export function howMuchHasDueDateMovedForwardChangedSince(epic, checkpointDate) {

    let dueDateWasPriorToTheFirstChangeAfterTheCheckpoint;
    let dueDateNow;
    let currentDate;
    // find the due date at "date"
    for (let changelog of [...epic.changelog].reverse()) {
        const createdDate = new Date(changelog.created);
        const dueDateSetItem = changelog.items.find((item) => item.field === "duedate");
        if (dueDateSetItem) {
            const fromDate = dueDateSetItem.from && new Date(dueDateSetItem.from);
            const toDate = dueDateSetItem.to && new Date(dueDateSetItem.to);
            // if this change was after "checkpoint", take "from"
            // if this change was before "checkpoint", take "to"
            
            
            currentDate = toDate;
            // we just moved the time after checkpointDate
            if ((createdDate > checkpointDate) && !dueDateWasPriorToTheFirstChangeAfterTheCheckpoint && fromDate) {
                dueDateWasPriorToTheFirstChangeAfterTheCheckpoint = fromDate;
            }
        }
    }
    if (!currentDate) {
        currentDate = new Date(epic["Due date"]);
    }
    if (!dueDateWasPriorToTheFirstChangeAfterTheCheckpoint) {
        dueDateWasPriorToTheFirstChangeAfterTheCheckpoint = currentDate;
    }

    return {
        currentDate,
        dateHasMovedForward: currentDate - DAY_IN_MS * 1 > dueDateWasPriorToTheFirstChangeAfterTheCheckpoint,
        dateHasChanged: dueDateWasPriorToTheFirstChangeAfterTheCheckpoint !== currentDate,
        dueDateWasPriorToTheFirstChangeAfterTheCheckpoint: dueDateWasPriorToTheFirstChangeAfterTheCheckpoint,
        daysChanged: Math.round((currentDate - dueDateWasPriorToTheFirstChangeAfterTheCheckpoint) / DAY_IN_MS)
    }
}

export function parseDateISOString(s) {
    if (!s) return s;

    // if this is a date already, assume we need to correct timezone
    if (s instanceof Date) {
        // fix timezone to UTC
        return new Date(s.getTime() + s.getTimezoneOffset() * 60 * 1000);
    }

    let ds = s.split(/\D/).map(s => parseInt(s));
    ds[1] = ds[1] - 1; // adjust month
    return new Date(...ds);
}

export const DAY_IN_MS = 1000 * 60 * 60 * 24;



export function sortByStartDate(issues) {
    return issues.sort((issueA, issueB) => {
        const dateA = issueA.start,
            dateB = issueB.start;
        return dateA - dateB;
    })
}

export function getLastDateFrom(initiatives, property) {
    const values = initiatives.filter(
        init => init[property]
    ).map(init => parseDateISOString(init[property]))
        .filter((number) => !isNaN(number));
    return values.length ? new Date(Math.max(...values)) : undefined;
}
export function getDateFromLastPeriod(initiatives, lowercasePhase, checkpoint) {
    const dates = initiatives.map(initiative => {
        if (initiative[lowercasePhase]) {
            const { dueDateWasPriorToTheFirstChangeAfterTheCheckpoint }
                = howMuchHasDueDateMovedForwardChangedSince(initiative[lowercasePhase], checkpoint);
            return dueDateWasPriorToTheFirstChangeAfterTheCheckpoint;
        }
    }).filter(d => d) // remove undefineds

    const date = Math.max(...dates);
    return new Date(date);
}


// This is a collection of children's timing ...
export function epicTimingData(epics) {
    const sorted = sortByStartDate(epics);
    // const due = endDateFromList(sorted)
    // ,dueLastPeriod = endDateFromList(sorted, "dueLastPeriod");
    
    return {
        issues: sorted,
        ... endDateDataFromList(sorted),
        ... firstDateDataFromList(sorted),
        ... endDateDataFromList(sorted),
        //dueLastPeriod: endDateFromList(sorted, "dueLastPeriod"),
        workingBusinessDays: epics.reduce((acc, cur) => {
            return acc + (cur.workingBusinessDays || 0)
        }, 0),
        weightedEstimate: epics.reduce((acc, cur) => {
            return acc + (cur.weightedEstimate || 0)
        }, 0)
    }
}



function endDateDataFromList(issues) {
    let maxDate = -Infinity, maxIndex;
    for( let i = 0; i < issues.length; i++) {
        const dueNumber = +issues[i].due;
        if(!isNaN(dueNumber) && dueNumber > 0 && dueNumber > maxDate) {
            maxDate = dueNumber;
            maxIndex = i;
        }
    }
    return maxIndex >=0 ? {due: new Date(issues[maxIndex].due), dueTo: issues[maxIndex].dueTo} : {};
}


function firstDateDataFromList(issues) {
    let minDate = Infinity, minIndex;
    for( let i = 0; i < issues.length; i++) {
        const startNumber = +issues[i].start;
        if(!isNaN(startNumber) && startNumber > 0 && startNumber < minDate) {
            minDate = startNumber;
            minIndex = i;
        }
    }
    return minIndex >=0 ? {start: new Date(issues[minIndex].start), startFrom: issues[minIndex].startFrom} : {};
}

export function getFirstDateFrom(initiatives, property) {
    const values = initiatives.filter(
        init => init[property]?.[START_DATE_KEY]
    ).map(init => parseDateISOString(init[property][START_DATE_KEY]));
    return values.length ? new Date(Math.min(...values)) : undefined;
}
