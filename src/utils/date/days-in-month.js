/**
 * Example usage:
  console.log(getDaysInMonth(2025, 2)); // February 2025 → 28 days (not a leap year)
  console.log(getDaysInMonth(2024, 2)); // February 2024 → 29 days (leap year)
  console.log(getDaysInMonth(2025, 4)); // April 2025 → 30 days
  console.log(getDaysInMonth(2025, 12)); // December 2025 → 31 days
 */

export function getDaysInMonth(year, month) {
  // Create a date for the first day of the next month
  const date = new Date(year, month, 0); // Month is 1-based for day 0
  return date.getDate(); // Returns the number of days in the month
}
