export function daysBetween(date1, date2) {
  // Normalize both dates to midnight
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);

  // Calculate the difference in milliseconds
  const diffInMs = d1 - d2;

  // Convert milliseconds to days and round to handle timezone shifts
  return Math.round(diffInMs / (1000 * 60 * 60 * 24));
}
