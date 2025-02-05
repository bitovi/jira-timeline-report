import React from "react";

import Heading from "@atlaskit/heading";
import Select from "@atlaskit/select";

import { useTimingCalculations } from "./hooks/useTimingCalculations";

function getPadding(depth: number) {
  return ["pl-0", "pl-8", "pl-16", "pl-24", "pl-32"][depth] ?? "pl-40";
}

const TimingCalculation = () => {
  const { selectableTimingLevels, updateCalculation } = useTimingCalculations();

  return (
    <>
      <div className="pt-8">
        <Heading size="medium">Timing Calculation</Heading>
        <p className="text-sm pt-1">Which dates are prioritized between parent and child?</p>
      </div>
      <div className="flex flex-col gap-2 my-2">
        <label className={`pr-2 py-2 ${getPadding(0)} self-start text-sm font-medium`}>
          {selectableTimingLevels[0]?.type}
        </label>
        {selectableTimingLevels.map((timingLevel, index) => {
          const options = timingLevel.calculations.map((value) => ({
            label: value.name,
            value: value.calculation,
            selected: value.selected,
          }));

          return (
            <div key={timingLevel.type} className={`flex flex-row ${getPadding(index)}`}>
              <div className="border-l-2 border-b-2 rounded-bl-lg w-6 mb-4">&nbsp;</div>
              <div className="flex flex-col w-full">
                <Select
                  isSearchable={false}
                  onChange={(event) => {
                    if (!event?.value) {
                      return;
                    }

                    updateCalculation(timingLevel.type, event.value);
                  }}
                  defaultValue={options.find(({ selected }) => selected)}
                  options={options}
                />
                <label className="p-2 pt-4 text-sm font-medium">{timingLevel.childType}</label>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
};

export default TimingCalculation;
