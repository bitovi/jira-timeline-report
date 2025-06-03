import { MINUTE_IN_S, HOUR_IN_S, DAY_IN_S } from '../../../../utils/date/get-date-days-ago';

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
