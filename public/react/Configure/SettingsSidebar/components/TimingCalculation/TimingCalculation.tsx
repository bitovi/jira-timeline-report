import { ObservableObject, value } from "../../../../../can.js";
import React, { useMemo } from 'react';
import untypedRouteData, { RouteData as RouteDataClass } from "../../../../../canjs/routing/route-data.js";

type RouteDataProps = typeof RouteDataClass.props;
type RouteData = {
    [k in keyof RouteDataProps]: any;
} & typeof ObservableObject;
const routeData: RouteData = untypedRouteData as RouteData;

const selectStyle = "min-w-[345px] bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2 dark:bg-gray-700 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"

import {getTimingLevels, IssueType} from "./helpers.js";
import { CanObservable, useCanObservable } from "../../../../hooks/useCanObservable/useCanObservable.js";

const DEFAULT_CALCULATION_METHOD = "widestRange";

function paddingClass(depth: number) {
    return [
      "pl-0",
      "pl-8",
      "pl-16",
      "pl-24",
      "pl-32"
    ][depth] ?? "pl-40";
}

const TimingCalculation = () => {
  const issueHierarchy = useCanObservable(value.from(routeData, "simplifiedIssueHierarchy") as unknown as CanObservable<IssueType[]>);

  const selectableTimingLevels = useMemo(() => {
      if(!issueHierarchy) {
          return [];
      } else {
          const allLevels = getTimingLevels(issueHierarchy, routeData.timingCalculations);
          return allLevels.slice(0, allLevels.length - 1);
      }
  }, [issueHierarchy]);

  function updateCalculation(type: string, value: string) {
      let current = {...routeData.timingCalculations};
      if(value === DEFAULT_CALCULATION_METHOD) {
          delete current[type]
      } else {
          current[type] = value;
      }
  
      routeData.timingCalculations = current;
  }

  return (
    <>
        <h3 className="h3">Timing Calculation</h3>
        <div className="flex flex-col gap-2 my-2">
            <label className={`pr-2 py-2 ${ paddingClass(0) } self-start`}>{selectableTimingLevels[0]?.type}</label>
            {selectableTimingLevels.map((timingLevel, index) => (
              <div key={timingLevel.type} className={`flex flex-row ${paddingClass(index)}`}>
                <div className="border-l-2 border-b-2 rounded-bl-lg w-6 mb-4">&nbsp;</div>
                <div className="flex flex-col">
                  <select className={selectStyle} onChange={(ev) => updateCalculation(timingLevel.type, ev.target.value)}>
                  {timingLevel.calculations.map(calculation => (
                      <option key={calculation.calculation} selected={calculation.selected} value={calculation.calculation}>{calculation.name}</option>
                  ))}
                  </select>
                  <label className="p-2 pt-4">{timingLevel.childType}</label>
                </div>
              </div>
            ))}
        </div>
      </>
    )
};

export default TimingCalculation;
