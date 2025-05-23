import React, { FC } from "react";
import Range from "@atlaskit/range";
import cn from "classnames";
import { useCompareTo } from "./hooks/useCompareTo";
import { useCompareToType } from "./hooks/useCompareToType";
import { useTimeSliderValue } from "./hooks/useTimeSliderValue/useTimeSliderValue";
import { getISOString, getLabelText } from "./utilities";

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
