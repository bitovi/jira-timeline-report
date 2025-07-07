import React from 'react';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import { Label } from '@atlaskit/form';
import type { AggregationReducer } from '../data/aggregate';
import { revenueReducer, issuesListReducer } from '../ui/aggreation-reducers';
import {
  totalWorkingDaysReducer,
  completedWorkingDaysReducer,
  remainingWorkingDaysReducer,
  workingDaysCompletionPercentageReducer,
  workingDaysBreakdownReducer,
  issuesWithoutEstimatesReducer,
  issuesWithoutAnyEstimatesReducer,
} from '../ui/total-working-days-reducers';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';
import { countReducer } from '../data/aggregate';

// Define available aggregators
const availableAggregators = [
  { key: 'revenue', reducer: revenueReducer, label: 'Revenue (Hours per week x Billing Rate)' },
  { key: 'issuesList', reducer: issuesListReducer, label: 'Issues List' },
  { key: 'count', reducer: countReducer('count'), label: 'Issue Count' },
  { key: 'totalWorkingDays', reducer: totalWorkingDaysReducer, label: 'Total Working Days' },
  { key: 'completedWorkingDays', reducer: completedWorkingDaysReducer, label: 'Completed Working Days' },
  { key: 'remainingWorkingDays', reducer: remainingWorkingDaysReducer, label: 'Remaining Working Days' },
  { key: 'completionPercentage', reducer: workingDaysCompletionPercentageReducer, label: 'Completion Percentage' },
  { key: 'workingDaysBreakdown', reducer: workingDaysBreakdownReducer, label: 'Working Days Breakdown' },
  { key: 'issuesWithoutEstimates', reducer: issuesWithoutEstimatesReducer, label: 'Issues Without Estimates' },
  {
    key: 'issuesWithoutAnyEstimates',
    reducer: issuesWithoutAnyEstimatesReducer,
    label: 'Issues Without Any Estimates',
  },
] as const;

export type AvailableAggregator = (typeof availableAggregators)[number];

interface SelectAggregatorProps {
  selectedKey: string;
  onAggregatorChange: (key: string) => void;
}

export const SelectAggregator: React.FC<SelectAggregatorProps> = ({ selectedKey, onAggregatorChange }) => {
  const selectedAggregator = availableAggregators.find((a) => a.key === selectedKey) || availableAggregators[0];

  return (
    <div className="mb-4 flex items-start">
      <div className="flex flex-col">
        <Label htmlFor="aggregator-select">Aggregator</Label>
        <DropdownMenu trigger={selectedAggregator.label} shouldRenderToParent>
          <DropdownItemGroup>
            {availableAggregators.map((aggOption) => (
              <DropdownItem
                key={aggOption.key}
                isSelected={aggOption.key === selectedKey}
                onClick={() => onAggregatorChange(aggOption.key)}
              >
                {aggOption.label}
              </DropdownItem>
            ))}
          </DropdownItemGroup>
        </DropdownMenu>
      </div>
    </div>
  );
};

export { availableAggregators };
export default SelectAggregator;
