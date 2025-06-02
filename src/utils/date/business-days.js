// functions to help calculate the number of business days

export function getBusinessDatesCount(startDate, endDate) {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}

export function getUTCEndDateFromStartDateAndBusinessDays(startDate, businessDays) {
  const curDate = new Date(startDate.getTime());
  const startDay = curDate.getUTCDay();

  // move to Monday ...
  if (startDay === 0) {
    // sunday
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  } else if (startDay === 6) {
    // saturday
    curDate.setUTCDate(curDate.getUTCDate() + 2);
  }

  const weeksToMoveForward = Math.floor(businessDays / 5);
  const remainingDays = businessDays % 5;

  curDate.setUTCDate(curDate.getUTCDate() + weeksToMoveForward * 7 + remainingDays);

  const endDay = curDate.getUTCDay();

  // move to Monday ...
  if (endDay === 0) {
    // sunday
    curDate.setUTCDate(curDate.getUTCDate() + 1);
  } else if (endDay === 6) {
    // saturday
    curDate.setUTCDate(curDate.getUTCDate() + 2);
  }

  return curDate;
}
