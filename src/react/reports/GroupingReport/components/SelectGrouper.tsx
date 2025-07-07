import React from 'react';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import { Label } from '@atlaskit/form';
import {
  dueInQuarterGrouper,
  dueInMonthGrouper,
  intersectMonthGrouper,
  intersectQuarterGrouper,
  parentGrouper,
  projectKeyGrouper,
  greatGrandParentGrouper,
  makeLinkGrouper,
} from '../ui/grouper';
import type { Grouper } from '../ui/grouper';
import type { LinkedIssue } from '../jira/linked-issue/linked-issue';

// Define available groupers
const availableGroupers = [
  { key: 'projectKey', grouper: projectKeyGrouper, label: 'Project Key' },
  { key: 'parent', grouper: parentGrouper, label: 'Parent' },
  { key: 'greatGrandParent', grouper: greatGrandParentGrouper, label: 'Great-grandparent' },
  { key: 'implementsLink', grouper: makeLinkGrouper('implements'), label: 'Implements Link' },
  { key: 'intersectMonth', grouper: intersectMonthGrouper, label: 'Intersect Month' },
  { key: 'intersectQuarter', grouper: intersectQuarterGrouper, label: 'Intersect Quarter' },
  { key: 'dueInQuarter', grouper: dueInQuarterGrouper, label: 'Due in Quarter' },
  { key: 'dueInMonth', grouper: dueInMonthGrouper, label: 'Due in Month' },
] as const;

export type AvailableGrouper = (typeof availableGroupers)[number];

interface SelectGrouperProps {
  selectedKey: string;
  onGrouperChange: (key: string) => void;
  label: string;
  disabled?: boolean;
  disabledKeys?: string[];
  otherSelectedGrouper?: Grouper<any, any, any>;
}

export const SelectGrouper: React.FC<SelectGrouperProps> = ({
  selectedKey,
  onGrouperChange,
  label,
  disabled = false,
  disabledKeys = [],
  otherSelectedGrouper,
}) => {
  const selectedGrouper = availableGroupers.find((g) => g.key === selectedKey) || availableGroupers[0];

  // Calculate which keys should be disabled based on matching groupByKey.key
  const computedDisabledKeys = [...disabledKeys];
  if (otherSelectedGrouper) {
    availableGroupers.forEach((grouperOption) => {
      if (
        grouperOption.grouper.groupByKey.key === otherSelectedGrouper.groupByKey.key &&
        grouperOption.key !== selectedKey
      ) {
        computedDisabledKeys.push(grouperOption.key);
      }
    });
  }

  return (
    <div className={`flex flex-col ${disabled ? 'opacity-50 pointer-events-none' : ''}`}>
      <Label htmlFor={`grouper-select-${label.toLowerCase()}`}>{label}</Label>
      <DropdownMenu trigger={selectedGrouper.label} shouldRenderToParent>
        <DropdownItemGroup>
          {availableGroupers.map((grouperOption) => (
            <DropdownItem
              key={grouperOption.key}
              isSelected={grouperOption.key === selectedKey}
              isDisabled={computedDisabledKeys.includes(grouperOption.key)}
              onClick={() => !computedDisabledKeys.includes(grouperOption.key) && onGrouperChange(grouperOption.key)}
            >
              {grouperOption.label}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
      </DropdownMenu>
    </div>
  );
};

export { availableGroupers };
export default SelectGrouper;
