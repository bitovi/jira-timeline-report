// HALF QUARTER
const HALF_QUARTERS = [
    [1, 1],  // Jan 1
    [2, 15], // Feb 15
    [4, 1],  // Apr 1
    [5, 15], // May 15
    [7, 1],  // Jul 1
    [8, 15], // Aug 15
    [10, 1], // Oct 1
    [11, 15] // Nov 15
];

/**
 * Aligns a date to the Monday on or before the current date.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The Monday on or before the current date.
 */
function alignToStartOfWeek(date) {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = (day === 0 ? -6 : 1) - day; // Offset to Monday
    const startOfWeek = new Date(date);
    startOfWeek.setDate(date.getDate() + diff);
    startOfWeek.setHours(0, 0, 0, 0);
    return startOfWeek;
}

/**
 * Aligns a date to the nearest Friday for the week end.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The nearest Friday date.
 */
function alignToEndOfWeek(date) {
    const day = date.getDay(); // 0 = Sunday, 1 = Monday, ...
    const diff = (day === 0 ? 5 : 5 - day); // Offset to Friday
    const endOfWeek = new Date(date);
    endOfWeek.setDate(date.getDate() + diff);
    endOfWeek.setHours(0, 0, 0, 0);
    return endOfWeek;
}

/**
 * Aligns a date to the start of the month.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The start of the month.
 */
function alignToStartOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth(), 1);
}

/**
 * Aligns a date to the end of the month.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The end of the month.
 */
function alignToEndOfMonth(date) {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0, 0, 0, 0, 0);
}

/**
 * Aligns a date to the start of the quarter.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The start of the quarter.
 */
function alignToStartOfQuarter(date) {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth, 1);
}

/**
 * Aligns a date to the end of the quarter.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The end of the quarter.
 */
function alignToEndOfQuarter(date) {
    const quarterStartMonth = Math.floor(date.getMonth() / 3) * 3;
    return new Date(date.getFullYear(), quarterStartMonth + 3, 0, 0, 0, 0, 0);
}

/**
 * Aligns a date to the nearest start of a half-quarter.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The nearest half-quarter start date.
 */
function alignToStartOfHalfQuarter(date) {
    const year = date.getFullYear();
    let nearestDate = null;
    let minDifference = Infinity;

    for (const [month, day] of HALF_QUARTERS) {
        const candidate = new Date(year, month - 1, day); // Months are 0-based

        if (month === 1 && date.getMonth() === 11) {
            candidate.setFullYear(year + 1); // Move Jan 1 to next year if the date is in December
        }

        const diff = Math.abs(candidate - date);

        if (diff < minDifference) {
            minDifference = diff;
            nearestDate = candidate;
        }
    }

    return nearestDate;
}

/**
 * Aligns a date to the nearest end of a half-quarter.
 * The end of a half-quarter is the day before the next half-quarter starts.
 * @param {Date} date - The input date to align.
 * @returns {Date} - The nearest half-quarter end date.
 */
function alignToEndOfHalfQuarter(date) {
    const year = date.getFullYear();
    let nearestEndDate = null;
    let minDifference = Infinity;

    for (let i = 0; i < HALF_QUARTERS.length; i++) {
        const [month, day] = HALF_QUARTERS[i];
        const nextHalfQuarterStart = new Date(year, month - 1, day);

        if (month === 1 && date.getMonth() === 11) {
            nextHalfQuarterStart.setFullYear(year + 1);
        }

        const candidateEnd = new Date(nextHalfQuarterStart.getTime() - 24 * 60 * 60 * 1000);

        if (candidateEnd >= date) {
            const diff = Math.abs(candidateEnd - date);

            if (diff < minDifference) {
                minDifference = diff;
                nearestEndDate = candidateEnd;
            }
        }
    }

    return nearestEndDate;
}

export const roundDate = {
    halfQuarter: {
        start: alignToStartOfHalfQuarter,
        end: alignToEndOfHalfQuarter
    },
    week: {
        start: alignToStartOfWeek,
        end: alignToEndOfWeek
    },
    month: {
        start: alignToStartOfMonth,
        end: alignToEndOfMonth
    },
    quarter: {
        start: alignToStartOfQuarter,
        end: alignToEndOfQuarter
    },
    day: {
        start: (x) => x,
        end: (x) => x
    }
};
