/**
 * Generator function that yields all business days (Monday-Friday) between two dates, inclusive.
 *
 * @param startDate - The start date (inclusive)
 * @param endDate - The end date (inclusive)
 * @yields Date objects for each business day in the range
 *
 * @example
 * ```typescript
 * const start = new Date('2024-01-01'); // Monday
 * const end = new Date('2024-01-05');   // Friday
 *
 * for (const date of businessDaysInclusive(start, end)) {
 *   console.log(date.toISOString().slice(0, 10));
 * }
 * // Outputs: 2024-01-01, 2024-01-02, 2024-01-03, 2024-01-04, 2024-01-05
 * ```
 */
export function* businessDaysInclusive(startDate: Date, endDate: Date): Generator<Date> {
  const current = new Date(startDate); // clone to avoid mutation

  while (current <= endDate) {
    const dayOfWeek = current.getDay(); // 0 = Sunday, 6 = Saturday
    if (dayOfWeek >= 1 && dayOfWeek <= 5) {
      yield new Date(current); // return a new Date instance
    }
    current.setDate(current.getDate() + 1);
  }
}

/**
 * Helper function to convert a Date to ISO date string (YYYY-MM-DD format).
 *
 * @param date - The date to convert
 * @returns ISO date string in YYYY-MM-DD format
 *
 * @example
 * ```typescript
 * const date = new Date('2024-01-15T10:30:00Z');
 * console.log(toISODateString(date)); // "2024-01-15"
 * ```
 */
export function toISODateString(date: Date): string {
  return date.toISOString().slice(0, 10);
}
