import { FC, useEffect } from "react";
import React, { useState, useRef } from "react";

import type {
  StatsUIData,
  SimulationIssueResult,
  MinimalSimulationIssueResult,
} from "./scheduler/stats-analyzer";
import type { GridUIData } from "./AutoScheduler";
import { getUTCEndDateFromStartDateAndBusinessDays } from "../../../utils/date/business-days";

type Column = {
  percentValue: number;
};

type Props = {
  issue: MinimalSimulationIssueResult | SimulationIssueResult;
  gridNumberOfDays: number;
  startOrDue: "start" | "due";
  selectedStartDate: Date;
};

const monthDateFormatter = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  timeZone: "UTC",
});

export const IssueSimulationDays: React.FC<Props> = ({
  issue,
  gridNumberOfDays,
  startOrDue,
  selectedStartDate,
}) => {
  const rawColumnData = startOrDue === "start" ? issue.startDays : issue.dueDays;
  const columns = createColumnData(rawColumnData, gridNumberOfDays, startOrDue);

  return (
    <div
      className={`${
        startOrDue === "start" ? "top-3" : "-top-3 pb-1"
      } grid transition-all ease-in-out duration-300 h-24 box-border`}
      style={{
        gridTemplateColumns: `repeat(${gridNumberOfDays}, 1fr)`,
        gridTemplateRows: "auto",
      }}
    >
      {columns.map((column, i) => (
        <div
          key={i}
          onMouseEnter={(e) => {
            console.log(
              "TOOLTIP",
              monthDateFormatter.format(
                getUTCEndDateFromStartDateAndBusinessDays(selectedStartDate, i)
              )
            );
          }}
          onMouseLeave={(e) => {
            console.log("HIDE TOOLTIP");
          }}
          className="flex h-full group hover:bg-neutral-30 transition-colors z-50"
        >
          <div
            className={`${
              startOrDue === "start"
                ? "self-end bg-blue-100 group-hover:bg-blue-200"
                : "self-start bg-green-100 group-hover:bg-green-300"
            } w-full  transition-colors`}
            style={{ height: `${column.percentValue}%` }}
          ></div>
        </div>
      ))}
    </div>
  );
};

type ColumnType = "start" | "end" | string; // adjust as needed

interface ColumnData {
  percentValue: number;
  totalCount: number;
  day: number;
}

export function createColumnData(values: number[], days: number, type: ColumnType): ColumnData[] {
  const columnData: ColumnData[] = [];

  for (let i = 0; i < days; i++) {
    columnData.push({
      percentValue: 0,
      totalCount: 0,
      day: i,
    });
  }

  let largestCount = 0;

  for (const dueDay of values) {
    const rounded = Math.round(dueDay);
    if (columnData[rounded]) {
      columnData[rounded].totalCount++;
      largestCount = Math.max(largestCount, columnData[rounded].totalCount);
    }
  }

  for (const column of columnData) {
    column.percentValue = largestCount > 0 ? (column.totalCount / largestCount) * 100 : 0;
  }

  return columnData;
}
