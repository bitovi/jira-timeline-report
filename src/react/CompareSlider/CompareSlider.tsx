import React, { FC } from "react";
import Range from "@atlaskit/range";
import cn from "classnames";
import { useRouteData } from "../hooks/useRouteData";
import { createLinearMapping, createInverseMapping } from "../../utils/math/linear-mapping";

const MINUTE_IN_S = 60;
const HOUR_IN_S = MINUTE_IN_S * 60;
const DAY_IN_S = 24 * HOUR_IN_S;

const MAPPING_POINTS = [
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
];

const useCompareTo = () => {
  return useRouteData<number, number | string>("compareTo");
};

const useCompareToType = () => {
  return useRouteData<"date" | "seconds">("compareToType");
};

type CompareTo = ReturnType<typeof useCompareTo>[0];
type SetCompareTo = ReturnType<typeof useCompareTo>[1];

const valueToSeconds = createLinearMapping(MAPPING_POINTS),
  secondsToValue = createInverseMapping(MAPPING_POINTS);

const useTimeSliderValue = (compareTo: CompareTo, setCompareTo: SetCompareTo) =>
  [
    100 - Math.round(secondsToValue(compareTo)),
    (value: CompareTo) => {
      const seconds = valueToSeconds(100 - value);
      setCompareTo(Math.round(seconds));
    },
  ] as const;

const getLabelText = (compareTo: CompareTo) => {
  if (compareTo === 0) {
    return {
      timeText: "now",
      unitText: "",
    };
  }

  if (compareTo < MINUTE_IN_S) {
    return {
      timeText: compareTo,
      unitText: "seconds ago",
    };
  }

  if (compareTo < HOUR_IN_S) {
    return {
      timeText: Math.round(compareTo / MINUTE_IN_S),
      unitText: "minutes ago",
    };
  }

  if (compareTo < DAY_IN_S) {
    return {
      timeText: Math.round(compareTo / HOUR_IN_S),
      unitText: "hours ago",
    };
  }

  if (compareTo == DAY_IN_S) {
    return {
      timeText: Math.round(compareTo / DAY_IN_S),
      unitText: "day ago",
    };
  }

  return {
    timeText: Math.round(compareTo / DAY_IN_S),
    unitText: "days ago",
  };
};

const getDateDaysAgoLocal = (daysAgo: number) => {
  const now = new Date(); // Current date and time in the user's local timezone

  // Create a new date object representing 'daysAgo' days before today
  const localDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - daysAgo);

  // Format the date as ISO 8601 (yyyy-mm-dd)
  return localDate.toISOString().split("T")[0];
};

const getISOString = (compareTo: number) => {
  if (compareTo < DAY_IN_S) {
    return getDateDaysAgoLocal(0);
  } else {
    const daysAgo = Math.round(compareTo / DAY_IN_S);
    return getDateDaysAgoLocal(daysAgo);
  }
};

const CompareSlider: FC = () => {
  const [compareTo, setCompareTo] = useCompareTo();
  const [compareToType] = useCompareToType();
  const [value, setValue] = useTimeSliderValue(compareTo, setCompareTo);

  const { timeText, unitText } = getLabelText(compareTo);
  const isoString = getISOString(compareTo);

  return (
    <>
    {/*
      The Range with its label needs to have a height of 62px to match with its
      neighboring dropdowns and labels.
    */}
    <div className="h-[62px]">
      <div className="flex justify-between text-neutral-801 text-xs">
        <div>
          {"Compare to "}
          <input
            type="date"
            className={cn(
              "text-xs rounded bg-neutral-201 py-1 px-2 leading-3 hover:bg-neutral-301 cursor-pointer",
              { "font-semibold": compareToType === "date" }
            )}
            value={isoString}
            onChange={(event) => setCompareTo(event.target.value)}
          />
        </div>
        <label htmlFor="compare-value" className="pt-1">
          <span
            className={cn({
              "font-semibold": compareToType === "seconds",
            })}
          >
            {timeText ? timeText + " " : null}
          </span>
          {unitText}
        </label>
      </div>

      {/*
        Range component doesn't have a way to override its styles.
        32px height is set here to match the other dropdowns.
        source: https://bitbucket.org/atlassian/atlassian-frontend-mirror/src/b1818b1030b96cb3c2996636d9f58413b5bcd3d3/design-system/range/src/styled.tsx#lines-167
      */}
      <div className="h-8">
        <Range
          id="compare-value"
          aria-label="controlled range"
          step={1}
          min={0}
          max={100}
          value={value}
          onChange={setValue}
        />
      </div>
    </div>
    </>
  );
};

export default CompareSlider;
