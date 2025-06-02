/**
 * Number of seconds in a minute
 */
export const MINUTE_IN_S = 60;

/**
 * Number of seconds in an hour
 */
export const HOUR_IN_S = MINUTE_IN_S * 60;

/**
 * Number of seconds in a day with 24 hours
 */
export const DAY_IN_S = HOUR_IN_S * 24;

/**
 * Returns the date string for a specific number of days ago, based on the local
 * time zone.
 * @param {number} daysAgo - Number of days before today to calculate the date
 * for.
 * @returns {string} - Date string in ISO 8601 format (YYYY-MM-DD) representing
 * the local date.
 */
const getDateDaysAgoLocal = (daysAgo) => {
  const now = new Date(); // Current date and time in the user's local timezone

  // Create a new date object representing 'daysAgo' days before today
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);

  // Format the date as ISO 8601 (yyyy-mm-dd)
  return localDate.toISOString().split('T')[0];
};

/**
 * Returns a date string in ISO 8601 format (YYYY-MM-DD) based on how many
 * seconds ago a given event occurred, relative to the current time.
 *
 * @param {number} compareTo - Time difference in seconds. If less than one day,
 * returns today's date.
 * @returns {string} - Date string in ISO 8601 format (YYYY-MM-DD) for the
 * computed number of days ago.
 */
export const getISOString = (compareTo) => {
  if (compareTo < DAY_IN_S) {
    return getDateDaysAgoLocal(0);
  } else {
    const daysAgo = Math.round(compareTo / DAY_IN_S);
    return getDateDaysAgoLocal(daysAgo);
  }
};
