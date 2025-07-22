/**
 * GroupingReport is a React component that enables users to group issues and issue data by various fields such as
 * parent, dates or labels and sum or roll up data for the groups.
 */
import React, { useState, Suspense } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { groupAndAggregate } from './data/groupAndAggregate';
import { createStableObjectKey, groupByKeys } from './data/group';

import type { AggregationReducer } from './data/aggregate';

import {
  parentGrouper,
  projectKeyGrouper,
  greatGrandParentGrouper,
  groupByProjectKey,
  YearMonthGroupValue,
  YearQuarterGroupValue,
} from './ui/grouper';
import {
  dueInQuarterGrouper,
  dueInMonthGrouper,
  intersectMonthGrouper,
  intersectQuarterGrouper,
} from './ui/date-groupers';
import type { Grouper } from './ui/grouper';
import { availableAggregators } from './components/SelectAggregator';
import { SelectMultipleAggregators } from './components/SelectMultipleAggregators';
import { SelectGrouper, availableGroupers } from './components/SelectGrouper';
import SelectAdditionalFields from './components/SelectAdditionalFields';

// Define RolledUpIssue and ObservableOfIssues types for prop typing

import { DerivedIssue } from '../../../jira/derived/derive';
import { linkIssues } from './jira/linked-issue/linked-issue';
import type { LinkedIssue } from './jira/linked-issue/linked-issue';

//type ObservableOfIssues = CanObservable<Array<RolledUpIssue>>;

interface GroupingReportProps {
  rollupTimingLevelsAndCalculationsObs: CanObservable<any[]>;
  filteredDerivedIssuesObs: CanObservable<Array<DerivedIssue>>;
  extraFieldsObs: CanObservable<string[]>;
  rowGroupObs: CanObservable<string>;
  colGroupObs: CanObservable<string>;
  aggregatorsObs: CanObservable<string[]>;
}

export const GroupingReport: React.FC<GroupingReportProps> = ({
  rollupTimingLevelsAndCalculationsObs,
  filteredDerivedIssuesObs,
  extraFieldsObs,
  rowGroupObs,
  colGroupObs,
  aggregatorsObs,
}) => {
  // Read the CanJS Observables
  const filteredDerivedIssues = useCanObservable(filteredDerivedIssuesObs) || [];
  const extraFields = useCanObservable(extraFieldsObs) || [];
  const rollupTimingLevelsAndCalculations = useCanObservable(rollupTimingLevelsAndCalculationsObs) || [];

  // Read grouping and aggregator observables
  const selectedRowGrouperKey = useCanObservable(rowGroupObs) || 'implementsLink';
  const selectedColGrouperKey = useCanObservable(colGroupObs) || 'dueInMonth';
  const selectedAggregatorKeys = useCanObservable(aggregatorsObs) || ['issuesList'];

  const selectedRowGrouper = availableGroupers.find((g) => g.key === selectedRowGrouperKey) || availableGroupers[0];
  const selectedColGrouper = availableGroupers.find((g) => g.key === selectedColGrouperKey) || availableGroupers[1];
  const selectedAggregators = availableAggregators.filter((a) => selectedAggregatorKeys.includes(a.key));

  // Handler functions to update observables
  const setSelectedRowGrouperKey = (key: string) => {
    rowGroupObs.value = key;
  };

  const setSelectedColGrouperKey = (key: string) => {
    colGroupObs.value = key;
  };

  const setSelectedAggregatorKeys = (keys: string[]) => {
    aggregatorsObs.value = keys;
  };

  // Handler for additional fields change
  const handleAdditionalFieldsChange = (selectedFields: Array<{ label: string; value: string }>) => {
    // Update the observable with the field values
    const fieldValues = selectedFields.map((field) => field.value);
    extraFieldsObs.value = fieldValues;
  };

  /*
  const missingFields = [];
  if(!extraFields.includes('Hours per week')) {
    missingFields.push('Hours per week');
  }
  if(!extraFields.includes('Billing Rate')) {
    missingFields.push('Billing Rate');
  }

  if(missingFields.length) {
    extraFieldsObs.value = [...extraFields, ...missingFields];
  }*/

  // Make linkedIssues and get the "report on issues"
  const linkedIssues = linkIssues(filteredDerivedIssues);

  const reportedIsseus = linkedIssues.filter((issue) => {
    return issue.hierarchyLevel === rollupTimingLevelsAndCalculations[0].hierarchyLevel;
  });

  const colGrouper = selectedColGrouper.grouper;
  const rowGrouper = selectedRowGrouper.grouper;

  const aggregators = selectedAggregators.map((a) => a.reducer);

  // Now you can use the selected groupers directly and get literal types
  const groupingKeys = [colGrouper.groupByKey, rowGrouper.groupByKey] as const;

  const result = groupAndAggregate(reportedIsseus, groupingKeys, aggregators as any);

  const { values: cols, titles: colTitles, keys: colKeys } = getAxisValues(result, colGrouper);
  const { values: rowObjs, titles: rowTitles, keys: rowKeys } = getAxisValues(result, rowGrouper);

  // Build a lookup: { [rowKey]: { [col]: aggregatedResult } }
  const grid = buildGrid(result, colGrouper, rowGrouper);

  // Calculate total columns (original columns × number of aggregators)
  const totalColumns = cols.length * aggregators.length;

  // CSS grid rendering for row/col matrix
  return (
    <div className="overflow-x-auto py-4">
      {/* Selection Controls */}
      <div className="mb-6 flex flex-wrap gap-6">
        {/* Row Grouper Selection */}
        <SelectGrouper
          selectedKey={selectedRowGrouperKey}
          onGrouperChange={setSelectedRowGrouperKey}
          label="Row Grouping ↓"
          otherSelectedGrouper={selectedColGrouper.grouper}
        />

        {/* Column Grouper Selection */}
        <SelectGrouper
          selectedKey={selectedColGrouperKey}
          onGrouperChange={setSelectedColGrouperKey}
          label="Column Grouping →"
          otherSelectedGrouper={selectedRowGrouper.grouper}
        />

        {/* Aggregator Selection */}
        <SelectMultipleAggregators
          selectedKeys={selectedAggregatorKeys}
          onAggregatorsChange={setSelectedAggregatorKeys}
        />

        {/* Additional Fields Selection */}
        <Suspense
          fallback={
            <div className="flex flex-col">
              <div className="text-sm text-gray-600">Loading fields...</div>
            </div>
          }
        >
          <SelectAdditionalFields
            selectedFields={extraFields.map((field) => ({ label: field, value: field }))}
            onFieldsChange={handleAdditionalFieldsChange}
            label="Additional Fields to Include"
            placeholder="Select fields to include in extraFields..."
          />
        </Suspense>
      </div>

      <div
        className="grid border bg-white"
        style={{
          gridTemplateColumns: `200px repeat(${totalColumns}, auto)`,
          gridAutoRows: 'minmax(40px,auto)',
        }}
      >
        {/* Header row */}
        <div
          className="font-bold p-2 bg-gray-50 sticky left-0 z-10 border-b border-r"
          style={{ gridRow: '1 / 3', gridColumn: 1 }}
        >
          {rowGrouper.label}
        </div>

        {/* Column group headers - spanning across aggregators */}
        {cols.map((c, colIdx) => (
          <div
            key={`col-group-${colKeys[colIdx]}`}
            className="font-bold p-2 text-center bg-gray-100 border-b border-r border-l-2 border-l-gray-400"
            style={{
              gridRow: 1,
              gridColumn: `${colIdx * aggregators.length + 2} / ${(colIdx + 1) * aggregators.length + 2}`,
            }}
          >
            {colTitles[colIdx]}
          </div>
        ))}

        {/* Aggregator headers */}
        {cols.map((c, colIdx) =>
          aggregators.map((aggregator, aggIdx) => {
            const aggregatorInfo = availableAggregators.find((a) => a.reducer.name === aggregator.name);
            const isFirstAggregator = aggIdx === 0;

            return (
              <div
                key={`${colKeys[colIdx]}-${aggregator.name}`}
                className={`font-medium p-2 text-center bg-gray-50 border-b border-r ${isFirstAggregator ? 'border-l-2 border-l-gray-400' : ''}`}
                style={{ gridRow: 2, gridColumn: colIdx * aggregators.length + aggIdx + 2 }}
              >
                <div className="text-sm">{aggregatorInfo?.label || aggregator.name}</div>
              </div>
            );
          }),
        )}
        {/* Row labels and cells */}
        {rowObjs.map((rowObj, rowIdx) => {
          const rowKey = rowKeys[rowIdx];
          return (
            <React.Fragment key={rowKey}>
              {/* Row label cell */}
              <div
                className="font-semibold p-2 bg-gray-50 sticky left-0 z-10 border-r border-b"
                style={{ gridRow: rowIdx + 3, gridColumn: 1 }}
              >
                {rowTitles[rowIdx]}
              </div>
              {/* Issue cells for each column and aggregator combination */}
              {colKeys.map((colKey, colIdx) =>
                aggregators.map((aggregator, aggIdx) => {
                  const isFirstAggregator = aggIdx === 0;

                  return (
                    <div
                      key={`${rowKey}-${colKey}-${aggregator.name}`}
                      className={`align-top p-2 border-b border-r ${isFirstAggregator ? 'border-l-2 border-l-gray-400' : ''}`}
                      style={{ gridRow: rowIdx + 3, gridColumn: colIdx * aggregators.length + aggIdx + 2 }}
                    >
                      {grid[rowKey]?.[colKey]?.[aggregator.name] as React.ReactNode}
                    </div>
                  );
                }),
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
};

export default GroupingReport;

/**
 * Returns only unique values from an array, using createStableObjectKey for objects and Set for primitives.
 */
function getUniqueValues<T>(values: T[]): T[] {
  if (values.length > 0 && typeof values[0] === 'object') {
    return Array.from(new Map(values.map((v) => [createStableObjectKey(v as any), v])).values());
  } else {
    return Array.from(new Set(values));
  }
}

// Helper to extract axis values (unique, sorted, filled, titled)
function getAxisValues<GroupValueType>(result: any[], grouper: Grouper) {
  const key = grouper.groupByKey.key;
  // filter out nulls (not sure we want this, but keeping for now)
  const rawValues = result.map((group) => group[key] as GroupValueType).filter((v) => v !== null);

  let values = getUniqueValues(rawValues);
  if (grouper.sort) {
    values.sort(grouper.sort as any);
  }
  if (grouper.fillGaps) {
    values = (grouper.fillGaps as any)(values);
  }
  const titles = grouper.titles(values);
  return { values, titles, keys: values.map((value) => createStableObjectKey(value)) };
}

/**
 * Builds a 2D grid lookup from grouped results, using the provided groupers and getGroupValue helper.
 */
function buildGrid<T>(
  aggregatedResult: T[],
  colGrouper: Grouper,
  rowGrouper: Grouper,
): Record<string, Record<string, T>> {
  const grid: Record<string, Record<string, T>> = {};
  for (const group of aggregatedResult) {
    const colValue = getGroupValue(group, colGrouper);
    const colKey = typeof colValue === 'string' ? colValue : createStableObjectKey(colValue as Record<string, any>);
    if (colValue === null) continue;
    const rowValue = getGroupValue(group, rowGrouper);
    const rowKey = typeof rowValue === 'string' ? rowValue : createStableObjectKey(rowValue as Record<string, any>);
    if (!grid[rowKey]) grid[rowKey] = {};
    grid[rowKey][colKey] = group as T;
  }
  return grid;
}

/**
 * Helper to extract group value for a given grouper from a group object.
 */
function getGroupValue(group: any, grouper: Grouper) {
  const key = grouper.groupByKey.key;
  return group[key];
}
