import type { FC } from "react";

import React, { useId } from "react";
import Select from "@atlaskit/select";
import VisuallyHidden from "@atlaskit/visually-hidden";
import { useCanObservable } from "../../../../hooks/useCanObservable";
import { value } from "../../../../../can";
import routeData from "../../../../../canjs/routing/route-data";

const secondaryReportTypes = [
  { label: "None", value: "none" },
  { label: "Status", value: "status" },
  { label: "Work Breakdown", value: "breakdown" },
];

const useSecondaryReportType = () => {
  const selectedSecondaryReportType = useCanObservable<string>(
    value.from(routeData, "secondaryReportType")
  );

  const setSelectedSecondaryReportType = (value: string) => {
    // @ts-expect-error
    routeData.secondaryReportType = value;
  };

  return {
    secondaryReportTypes,
    selectedSecondaryReportType: secondaryReportTypes.find(
      ({ value }) => value === selectedSecondaryReportType
    ),
    setSelectedSecondaryReportType,
  };
};

const SecondaryReportType: FC = () => {
  const id = useId();
  const { secondaryReportTypes, selectedSecondaryReportType, setSelectedSecondaryReportType } =
    useSecondaryReportType();

  return (
    <div className="flex items-center gap-2">
      <VisuallyHidden>
        <label htmlFor={id}>Secondary Report Type</label>
      </VisuallyHidden>
      <Select
        id={id}
        className="flex-1"
        options={secondaryReportTypes}
        value={selectedSecondaryReportType}
        onChange={(option) => setSelectedSecondaryReportType(option?.value ?? "")}
      />
    </div>
  );
};

export default SecondaryReportType;
