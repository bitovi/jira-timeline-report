import { FC, useEffect } from 'react';
import React, { useState, useRef } from 'react';

import type { StatsUIData, SimulationIssueResult, MinimalSimulationIssueResult } from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';
import { getUTCEndDateFromStartDateAndBusinessDays } from '../../../utils/date/business-days';

import { Popper } from '@atlaskit/popper';
import { set } from 'react-hook-form';

type Column = {
  percentValue: number;
};

type Props = {
  issue: MinimalSimulationIssueResult | SimulationIssueResult;
  gridNumberOfDays: number;
  startOrDue: 'start' | 'due';
  selectedStartDate: Date;
};

const monthDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  timeZone: 'UTC',
});

export const IssueSimulationDays: React.FC<Props> = ({ issue, gridNumberOfDays, startOrDue, selectedStartDate }) => {
  const rawColumnData = startOrDue === 'start' ? issue.startDays : issue.dueDays;
  const columns = createColumnData(rawColumnData, gridNumberOfDays, startOrDue);

  return (
    <>
      <div
        className={`${
          startOrDue === 'start' ? 'top-3' : '-top-3 pb-1'
        } grid transition-all ease-in-out duration-300 h-24 box-border hover:bg-neutral-10 transition-colors`}
        style={{
          gridTemplateColumns: `repeat(${gridNumberOfDays}, 1fr)`,
          gridTemplateRows: 'auto',
        }}
      >
        {columns.map((column, i) => (
          <SimulationDay
            key={i}
            issue={issue}
            column={column}
            gridNumberOfDays={gridNumberOfDays}
            startOrDue={startOrDue}
            selectedStartDate={selectedStartDate}
          />
        ))}
      </div>
    </>
  );
};

function SimulationDay({
  issue,
  column,
  startOrDue,
  selectedStartDate,
}: {
  issue: MinimalSimulationIssueResult | SimulationIssueResult;
  column: ColumnData;
  gridNumberOfDays: number;
  startOrDue: 'start' | 'due';
  selectedStartDate: Date;
}) {
  const [dataElement, setDataElement] = useState<HTMLElement | null>(null);

  return (
    <>
      <div
        onMouseEnter={(e) => {
          console.log(
            'TOOLTIP',
            monthDateFormatter.format(getUTCEndDateFromStartDateAndBusinessDays(selectedStartDate, column.day)),
          );
          setDataElement(e.currentTarget);
        }}
        onMouseLeave={() => setDataElement(null)}
        className="flex h-full group hover:bg-neutral-30 transition-colors z-30"
      >
        <div
          className={`${
            startOrDue === 'start'
              ? 'self-end bg-blue-100 group-hover:bg-blue-200'
              : 'self-start bg-green-100 group-hover:bg-green-300'
          } w-full  transition-colors`}
          style={{ height: `${column.percentValue}%` }}
        />
      </div>

      {dataElement && (
        <Popper referenceElement={dataElement} placement="bottom">
          {({ ref, style }: { ref: React.Ref<HTMLDivElement>; style: React.CSSProperties }) => {
            const date = getUTCEndDateFromStartDateAndBusinessDays(selectedStartDate, column.day);
            const values = issue[startOrDue === 'start' ? 'startDays' : 'dueDays'];

            const index = values.findIndex((value) => {
              return value > column.day;
            });
            const cumulativeProbability = (index === -1 ? values.length : index) / values.length;
            const timingName = startOrDue === 'start' ? 'starts before or on' : 'ends after or on';
            const pastTenseName = startOrDue === 'start' ? 'started' : 'ended';
            let probability = startOrDue === 'start' ? cumulativeProbability * 100 : (1 - cumulativeProbability) * 100;
            const color = startOrDue === 'start' ? 'bg-blue-500' : 'bg-green-500';

            return (
              <div ref={ref} style={style} className="z-50 p-2">
                <div className="p-2">
                  <div className={`${color} rounded text-white text-center p-1`}>
                    <h5>{toFixed(probability, 1)}% chance</h5>
                    <p className="text-sm">issue {timingName}</p>
                    <p>{monthDateFormatter.format(date)}.</p>
                  </div>
                  <div className="bg-neutral-200 rounded text-white mt-2 p-1 text-center">
                    <h5> {toFixed((100 * column.totalCount) / values.length, 1)}% of the time,</h5>
                    <p>the work {pastTenseName} this day.</p>
                  </div>
                </div>
              </div>
            );
          }}
        </Popper>
      )}
    </>
  );
}

type ColumnType = 'start' | 'end' | string; // adjust as needed

export interface ColumnData {
  percentValue: number;
  totalCount: number;
  day: number;
}

function toFixed(num: Number, precision: number) {
  return (+(Math.round(+(num + 'e' + precision)) + 'e' + -precision)).toFixed(precision);
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
