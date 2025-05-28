import type { FC } from "react";

import React from "react";

import UncertaintySlider from "./components/UncertaintySlider";
import { useUncertaintyWeight } from "../../hooks/useUncertaintyWeight";
import { useSelectedStartDate } from "../../hooks/useSelectedStartDate/useSelectedStartDate";
import Button from "@atlaskit/button/new";
import { useSelectedIssueType } from "../../../../services/issues";

export type UncertaintyWeight = number | "average";

const Controls: FC = () => {
  const [selectedStartDate, setSelectedStartDate] = useSelectedStartDate();
  const [uncertaintyWeight, setUncertaintyWeight] = useUncertaintyWeight();
  const { selectedIssueType } = useSelectedIssueType();

  return (
    <div className="flex">
      <UncertaintySlider uncertaintyWeight={uncertaintyWeight} onChange={setUncertaintyWeight} />
      <label htmlFor="date-picker">Start Date:</label>
      <input
        className="border border-gray-300 rounded-md px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-100 dark:bg-white/10 dark:text-white"
        type="date"
        // format for input
        value={selectedStartDate.toISOString().split("T")[0]}
        onChange={(e) => setSelectedStartDate(e.target.valueAsDate)}
      />
      <Button appearance="primary">Update {selectedIssueType} Dates</Button>
    </div>
  );
};

export default Controls;
