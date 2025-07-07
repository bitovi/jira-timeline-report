import React from 'react';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import { Label } from '@atlaskit/form';
import { availableAggregators } from './SelectAggregator';
import type { AvailableAggregator } from './SelectAggregator';

interface SelectMultipleAggregatorsProps {
  selectedKeys: string[];
  onAggregatorsChange: (keys: string[]) => void;
}

export const SelectMultipleAggregators: React.FC<SelectMultipleAggregatorsProps> = ({
  selectedKeys,
  onAggregatorsChange,
}) => {
  const selectedAggregators = availableAggregators.filter((a) => selectedKeys.includes(a.key));

  const handleToggle = (key: string) => {
    if (selectedKeys.includes(key)) {
      // Remove if already selected
      onAggregatorsChange(selectedKeys.filter((k) => k !== key));
    } else {
      // Add if not selected
      onAggregatorsChange([...selectedKeys, key]);
    }
  };

  const displayText =
    selectedAggregators.length === 0
      ? 'Select Aggregators...'
      : selectedAggregators.length === 1
        ? selectedAggregators[0].label
        : `${selectedAggregators.length} Aggregators Selected`;

  return (
    <div className="mb-4 flex items-start">
      <div className="flex flex-col">
        <Label htmlFor="aggregators-select">Aggregate</Label>
        <DropdownMenu trigger={displayText} shouldRenderToParent>
          <DropdownItemGroup>
            {availableAggregators.map((aggOption) => (
              <DropdownItem
                key={aggOption.key}
                isSelected={selectedKeys.includes(aggOption.key)}
                onClick={() => handleToggle(aggOption.key)}
              >
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={selectedKeys.includes(aggOption.key)}
                    onChange={() => {}} // Handled by onClick above
                    className="w-4 h-4"
                  />
                  {aggOption.label}
                </div>
              </DropdownItem>
            ))}
          </DropdownItemGroup>
        </DropdownMenu>
        {selectedAggregators.length > 0 && (
          <div className="mt-2 text-sm text-gray-600">
            Selected: {selectedAggregators.map((a) => a.label).join(', ')}
          </div>
        )}
      </div>
    </div>
  );
};

export default SelectMultipleAggregators;
