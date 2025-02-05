import React from "react";

const selectStyle =
  "min-w-[345px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500";

import { useTimingCalculations } from "./hooks/useTimingCalculations";

function getPadding(depth: number) {
  return ["pl-0", "pl-8", "pl-16", "pl-24", "pl-32"][depth] ?? "pl-40";
}

const TimingCalculation = () => {
  const { selectableTimingLevels, updateCalculation } = useTimingCalculations();

  return (
    <>
      <h3 className="h3">Timing Calculation</h3>
      <div className="flex flex-col gap-2 my-2">
        <label className={`pr-2 py-2 ${getPadding(0)} self-start`}>
          {selectableTimingLevels[0]?.type}
        </label>
        {selectableTimingLevels.map((timingLevel, index) => (
          <div key={timingLevel.type} className={`flex flex-row ${getPadding(index)}`}>
            <div className="border-l-2 border-b-2 rounded-bl-lg w-6 mb-4">&nbsp;</div>
            <div className="flex flex-col">
              <select
                className={selectStyle}
                onChange={(ev) => updateCalculation(timingLevel.type, ev.target.value)}
              >
                {timingLevel.calculations.map((calculation) => (
                  <option
                    key={calculation.calculation}
                    selected={calculation.selected}
                    value={calculation.calculation}
                  >
                    {calculation.name}
                  </option>
                ))}
              </select>
              <label className="p-2 pt-4">{timingLevel.childType}</label>
            </div>
          </div>
        ))}
      </div>
    </>
  );
};

export default TimingCalculation;
