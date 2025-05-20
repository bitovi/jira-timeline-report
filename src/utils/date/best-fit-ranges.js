const DAY_IN_MS = 1000 * 60 * 60 * 24;

export const monthDateFormatter = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

export const yearDateFormatter = new Intl.DateTimeFormat('en-US', { year: 'numeric', timeZone: 'UTC' });

// these helpers could probably exist elsehwere

function getQuarter(date) {
    const month = date.getMonth();
    return Math.floor(month / 3) + 1;
}

function getYear(date) {
    return date.getFullYear();
}

export function getStartOfThisQuarter(date) {
    const quarter = getQuarter(date);
    const year = getYear(date);
    return new Date(year, (quarter - 1) * 3, 1);
}

export function getEndOfThisQuarter(date) {
    const quarter = getQuarter(date);
    const year = getYear(date);
    return new Date(year, quarter * 3, 0);
}

export function getStartOfNextQuarter(date) {
    const quarter = getQuarter(date);
    const year = getYear(date);
    if (quarter === 4) {
        return new Date(year + 1, 0, 1);
    } else {
        return new Date(year, quarter * 3, 1);
    }
}

export function countBusinessDays(startDate, endDate) {
    var count = 0;
    var currentDate = new Date(startDate);

    // Loop over each day from startDate to endDate ... allow for 1 hr 
    // daylight savings difference ...
    while (endDate > currentDate ) {
        var dayOfWeek = currentDate.getUTCDay();

        // Check if it's a weekday (Monday = 1, ..., Friday = 5)
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            count++;
        }

        // Move to the next day
        currentDate.setUTCDate(currentDate.getUTCDate() + 1);
    }

    var dayOfWeek = currentDate.getUTCDay();

    // Check if it's a weekday (Monday = 1, ..., Friday = 5)
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
        count++;
    }

    return count;
}

function getNextBusinessDay(date){
    // Create a new date object to avoid modifying the original date
    var nextDay = new Date(date);


    // Set time to the end of the current day
    nextDay.setUTCHours(23, 59, 59, 999);

    // Add 1 millisecond to move to the start of the next day
    nextDay.setTime(nextDay.getTime() + 1);
    if(nextDay.getUTCDay() === 0 || nextDay.getUTCDay() === 6) {
        return getNextBusinessDay(nextDay)
    }
    return nextDay;
}
function getFirstBusinessDay(date){
    if(date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
        return date;
    } else {
        return getNextBusinessDay(date);
    }
}

function getPreviousBusinessDay(date){
    // Create a new date object to avoid modifying the original date
    var prevDay = new Date(date);

    prevDay.setDate(prevDay.getDate() - 1);

    if(prevDay.getUTCDay() === 0 || prevDay.getUTCDay() === 6) {
        return getPreviousBusinessDay(prevDay)
    }
    return prevDay;
}

function getLastBusinessDay(date){
    if(date.getUTCDay() !== 0 && date.getUTCDay() !== 6) {
        return date;
    } else {
        return getPreviousBusinessDay(date);
    }
}

const makeDateRanges = function(startDate, endDate) {
    const ranges = [];
    let cur = startDate;
    const endBusinessDay = getLastBusinessDay(endDate);

    while(cur <= endDate) {
        // there is no promise that this day is on a business day ...
        let startBusinessDayOfRange = getFirstBusinessDay(cur);
        let startOfNextRange = this.getStartOfNextRange(cur);
        let possibleEndBusinessDayOfRange = getPreviousBusinessDay(startOfNextRange);

        const endBusinessDayOfRange = startOfNextRange > endBusinessDay ? endBusinessDay : possibleEndBusinessDayOfRange,
            startDay = countBusinessDays(startDate, startBusinessDayOfRange), // n^2
            endDay = countBusinessDays(startDate, endBusinessDayOfRange);
        
        // sometimes the start and end would be the same day. 
        if(endDay - startDay !== 0 ) {
            ranges.push({
                get start(){
                    throw "nope";
                },
                get end(){
                    throw "nope";
                },
                startBusinessDay: startBusinessDayOfRange,
                prettyStart: this.prettyDate(startBusinessDayOfRange),

                endBusinessDay: endBusinessDayOfRange,
                prettyEnd: this.prettyDate(endBusinessDayOfRange),
                type: this.name,
                startDay,
                endDay,
                days:  endDay - startDay + 1,
                businessDays: countBusinessDays(startBusinessDayOfRange,  endBusinessDayOfRange)
            });
        }
        
        cur = startOfNextRange;
    }
    return ranges;
};


const ranges = [
    {
        name: "days",
        aveDays: 1,
        getStartOfNextRange: getNextBusinessDay,
        dateRanges: makeDateRanges,
        prettyDate(date){
            return monthDateFormatter.format(date);
        }
    },
    {
        name: "weeks",
        aveDays: 7,
        getStartOfNextRange(date) {
            // WHole: M->M
            // Fractional: Th: Th-M

            var nextMonday = new Date(date);

            // Calculate how many days to add to get to the next Monday
            // Day of the week is represented as 0 (Sunday) to 6 (Saturday)
            var daysToAdd = (8 - nextMonday.getDay()) % 7;
            if (daysToAdd === 0) {
                daysToAdd = 7; // If today is Monday, move to the next Monday
            }

            // Add the required number of days
            nextMonday.setDate(nextMonday.getDate() + daysToAdd);

            return nextMonday;
        },
        dateRanges: makeDateRanges,
        prettyDate(date){
            return monthDateFormatter.format(date);
        }
    },
    {
        name: "months",
        aveDays: 30,
        dateRanges: makeDateRanges,
        // dec 5 -> Jan 1st, 19 days
        // jan 1, feb 1, 23

        // 67
        // Nov 3 -> Feb 04
        //   Nov - [1,21] 20
        //   Dec - [21,42] 21
        //   Jan - [42,65] 23
        //   Needs 3 more days 
        //   Feb 5th -  3
        //         [65, 67] 2 ... should be 3 days wide ...

        // 67 grid days 3/27
        // 
        getStartOfNextRange(date){
            var year = date.getUTCFullYear();
            var month = date.getUTCMonth();
        
            month++;
        
            if (month > 11) {
                month = 0;
                year++;
            }
        
            return new Date(Date.UTC(year, month, 1));
        },
        prettyDate(date){
            return monthDateFormatter.format(date);
        }
    },
    {
        name: "quarters",
        aveDays: 91,
        dateRanges: makeDateRanges,
        prettyDate(date){
            return monthDateFormatter.format(date);
        },
        getStartOfNextRange(date){
            return getStartOfNextQuarter(date);
        }
    },
    {
        name: "years",
        aveDays: 365,
        dateRanges: makeDateRanges,
        prettyDate(date){
            return yearDateFormatter.format(date);
        },
        getStartOfNextRange(date){
            var year = date.getUTCFullYear();
            year++;
            return new Date(Date.UTC(year, 0, 1));
        }
    }
];



export function bestFitRanges(startDate, endDate, maxBuckets){
    const startUTC = toUTCStartOfDay(startDate);
	const endUTC = toUTCStartOfDay(endDate);

    const daysApart = (endUTC - startUTC) / DAY_IN_MS;
    
    const range = bestFitRange(daysApart, maxBuckets)

    return range.dateRanges(startUTC, endUTC);
}

function toUTCStartOfDay(date) {
    // Create a new date object to avoid modifying the original date
    var utcDate = new Date(date);

    // Set the time to the start of the day in UTC
    utcDate.setUTCHours(0, 0, 0, 0);

    return utcDate;
}

export function bestFitRange(daysApart, maxBuckets) {
    // which range is closest
    const buckets = ranges.map( range => daysApart / range.aveDays); // 10 , 1.4, .3

    const tooHighIndex = buckets.findLastIndex( bucket => (bucket >  maxBuckets));

    let range
    if(tooHighIndex === -1) {
        range = ranges[0]
    }
    else if(tooHighIndex + 1 === ranges.length) {
        range = ranges[tooHighIndex];
    } 
    else {
        range = ranges[tooHighIndex + 1]
    }
    return range;
}