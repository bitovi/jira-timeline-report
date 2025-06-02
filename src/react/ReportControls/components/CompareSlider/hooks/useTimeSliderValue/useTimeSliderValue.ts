import { CompareTo, SetCompareTo } from '../useCompareTo';
import { MINUTE_IN_S, HOUR_IN_S, DAY_IN_S } from '../../../../../../utils/date/get-date-days-ago';
import { createInverseMapping, createLinearMapping } from '../../../../../../utils/math/linear-mapping';

export const MAPPING_POINTS = [
  [0, 0],
  [2, 60],
  [3, 5 * MINUTE_IN_S],
  [4, 10 * MINUTE_IN_S],
  [5, 30 * MINUTE_IN_S],
  [6, HOUR_IN_S],
  [7, 3 * HOUR_IN_S],
  [8, 6 * HOUR_IN_S],
  [9, 12 * HOUR_IN_S],
  [10, DAY_IN_S],
  [69, 60 * DAY_IN_S],
  [100, 365 * DAY_IN_S],
] as const;

const valueToSeconds = createLinearMapping(MAPPING_POINTS);
const secondsToValue = createInverseMapping(MAPPING_POINTS);

export const useTimeSliderValue = (compareTo: CompareTo, setCompareTo: SetCompareTo) =>
  [
    100 - Math.round(secondsToValue(compareTo)),
    (value: CompareTo) => {
      const seconds = valueToSeconds(100 - value);
      setCompareTo(Math.round(seconds));
    },
  ] as const;
