/** Intl formatter matching the legacy report's `dateFormatter` — e.g. `Mar 9`. */
const formatter = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' });

/** Format a date as `Mon D` (e.g. `Mar 9`), or `''` for a missing date. */
export const formatDate = (date?: Date | null): string => (date ? formatter.format(date) : '');
