export function timeRangeShorthand(totalDays, daysPerWeek = 7) {
  if (!Number.isFinite(totalDays) || totalDays < 0) {
    // Handle invalid input or negative days the way you prefer
    return '0d';
  }

  const weeks = Math.floor(totalDays / daysPerWeek);
  const days = totalDays % daysPerWeek;
  if (weeks) {
    return `${weeks}w ${days}d`;
  } else {
    return `${days}d`;
  }
}
