export const MINUTE_IN_S = 60;
export const HOUR_IN_S = MINUTE_IN_S * 60;
export const DAY_IN_S = 24 * HOUR_IN_S;

const getDateDaysAgoLocal = (daysAgo: number) => {
  const now = new Date(); // Current date and time in the user's local timezone

  // Create a new date object representing 'daysAgo' days before today
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);

  // Format the date as ISO 8601 (yyyy-mm-dd)
  return localDate.toISOString().split('T')[0];
};

export const getISOString = (compareTo: number) => {
  if (compareTo < DAY_IN_S) {
    return getDateDaysAgoLocal(0);
  } else {
    const daysAgo = Math.round(compareTo / DAY_IN_S);
    return getDateDaysAgoLocal(daysAgo);
  }
};

export const getLabelText = (compareTo: number): { timeText: string | number; unitText: string } => {
  if (compareTo === 0) {
    return {
      timeText: 'now',
      unitText: '',
    };
  }

  if (compareTo < MINUTE_IN_S) {
    return {
      timeText: compareTo,
      unitText: 'seconds ago',
    };
  }

  if (compareTo < HOUR_IN_S) {
    return {
      timeText: Math.round(compareTo / MINUTE_IN_S),
      unitText: 'minutes ago',
    };
  }

  if (compareTo < DAY_IN_S) {
    return {
      timeText: Math.round(compareTo / HOUR_IN_S),
      unitText: 'hours ago',
    };
  }

  if (compareTo == DAY_IN_S) {
    return {
      timeText: Math.round(compareTo / DAY_IN_S),
      unitText: 'day ago',
    };
  }

  return {
    timeText: Math.round(compareTo / DAY_IN_S),
    unitText: 'days ago',
  };
};
