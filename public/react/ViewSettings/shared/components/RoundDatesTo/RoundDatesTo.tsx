import type { FC } from "react";

import React, { useId } from "react";
import Select from "@atlaskit/select";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useCanObservable } from "../../../../hooks/useCanObservable";
import routeData from "../../../../../canjs/routing/route-data";
import { value } from "../../../../../can";

const useRoundDatesTo = () => {
  const roundDatesTo = [
    { value: "day", label: "Day" },
    { value: "week", label: "Week" },
    { value: "month", label: "Month" },
    { value: "halfQuarter", label: "Half Quarter" },
    { value: "quarter", label: "Quarter" },
  ];

  const selectedRoundDatesTo = useCanObservable<string>(value.from(routeData, "roundTo"));

  const setSelectedRoundDatesTo = (value: string) => {
    // @ts-expect-error
    routeData.roundTo = value;
  };

  return {
    roundDatesTo,
    selectedRoundDatesTo: roundDatesTo.find(({ value }) => value === selectedRoundDatesTo),
    setSelectedRoundDatesTo,
  };
};

const RoundDatesTo: FC = () => {
  const id = useId();
  const { roundDatesTo, selectedRoundDatesTo, setSelectedRoundDatesTo } = useRoundDatesTo();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Round Dates To</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={roundDatesTo}
        value={selectedRoundDatesTo}
        onChange={(option) => setSelectedRoundDatesTo(option?.value ?? "")}
      />
    </div>
  );
};

export default RoundDatesTo;
