/**
 * The Table report's From→To hierarchy range control (spec/012-table-and-grouper/selectedIssueTypeFilter.md).
 *
 * A single "Hierarchy" popup summarising the current range on its trigger:
 *   - "Full"           — From is the top level and To is the deepest level (full descent).
 *   - "Outcome"        — a single level (From === To).
 *   - "Outcome-Story"  — a From→To range.
 *
 * The popup body has two selects and a checkbox:
 *   - **From** = the top level (rows / primary issues). Binds `selectedIssueType` (route-data).
 *   - **To**   = the bottom level the report descends to. Binds the optional `toIssueType` cap;
 *     selecting the deepest level clears the cap (route-data resolves absent ⇒ deepest, no persist).
 *   - **Show full hierarchy** = clears BOTH params, so From self-heals to the top level and To
 *     resolves to the deepest — i.e. the whole tree.
 *
 * Releases are intentionally out of scope for this control. Loading mirrors SelectIssueType.
 */
import React, { FC, ReactNode, useState } from 'react';

import { Label } from '@atlaskit/form';
import { Checkbox } from '@atlaskit/checkbox';
import Popup from '@atlaskit/popup';
import ChevronDownIcon from '@atlaskit/icon/utility/chevron-down';

import { useRouteData } from '../../../hooks/useRouteData';

type IssueHierarchy = {
  name: string;
  hierarchyLevel: number;
};

const ControlCell: FC<{ label: string; children: ReactNode }> = ({ label, children }) => (
  <div className="pt-1 flex flex-col items-start">
    <Label htmlFor="">{label}</Label>
    {children}
  </div>
);

const LevelSelect: FC<{
  testId: string;
  value: string;
  options: IssueHierarchy[];
  onChange: (value: string) => void;
}> = ({ testId, value, options, onChange }) => (
  <select
    data-testid={testId}
    className="border border-neutral-301 rounded px-2 py-1.5 text-sm bg-white w-full cursor-pointer"
    value={value}
    onChange={(e) => onChange(e.target.value)}
  >
    {options.map((level) => (
      <option key={level.name} value={level.name}>
        {level.name + 's'}
      </option>
    ))}
  </select>
);

const SelectHierarchyRange: FC = () => {
  const [selectedIssueType, setSelectedIssueType] = useRouteData<string>('selectedIssueType');
  const [toIssueType, setToIssueType] = useRouteData<string>('toIssueType');
  const [issueHierarchy] = useRouteData<IssueHierarchy[] | null>('issueHierarchy');
  const [isOpen, setIsOpen] = useState(false);

  if (!issueHierarchy || !issueHierarchy.length) {
    return (
      <ControlCell label="Hierarchy">
        <button
          type="button"
          disabled
          className="inline-flex items-center gap-1 text-sm rounded bg-neutral-201 px-2 py-1 leading-4 text-neutral-801"
        >
          Loading…
        </button>
      </ControlCell>
    );
  }

  // issueHierarchy is ordered top→bottom: index 0 is the top level, the last entry the deepest.
  const lastIndex = issueHierarchy.length - 1;
  const deepestName = issueHierarchy[lastIndex].name;

  const fromIndex = Math.max(
    0,
    issueHierarchy.findIndex((level) => level.name === selectedIssueType),
  );
  const fromName = issueHierarchy[fromIndex].name;

  // route-data resolves an absent/invalid cap to the deepest level, so a resolved value equal to the
  // deepest means "full descent". Clamp the displayed To index to at/below From.
  const rawToIndex = issueHierarchy.findIndex((level) => level.name === toIssueType);
  const toIndex = rawToIndex >= fromIndex ? rawToIndex : lastIndex;
  const toName = issueHierarchy[toIndex].name;

  const isFull = fromIndex === 0 && toIndex === lastIndex;
  const summary = isFull ? 'Full' : fromIndex === toIndex ? fromName : `${fromName}-${toName}`;

  // To options are the levels at or below From (a cap can never be above From).
  const toOptions = issueHierarchy.slice(fromIndex);

  const handleFrom = (name: string) => setSelectedIssueType(name);

  const handleTo = (name: string) => {
    // Selecting the deepest level is equivalent to "no cap" — clear it so the URL stays clean and
    // the param does not re-add itself.
    setToIssueType(name === deepestName ? '' : name);
  };

  const handleShowFull = (checked: boolean) => {
    // Full hierarchy = clear BOTH endpoints. From self-heals to the top level (required primary),
    // To resolves to the deepest — the whole tree.
    if (checked) {
      setSelectedIssueType('');
      setToIssueType('');
    }
  };

  return (
    <ControlCell label="Hierarchy">
      <Popup
        isOpen={isOpen}
        onClose={() => setIsOpen(false)}
        placement="bottom-start"
        content={() => (
          <div className="p-4 w-80 flex flex-col gap-3" data-testid="hierarchy-popover">
            <div className="flex gap-3">
              <div className="flex flex-col flex-1 gap-1">
                <span className="text-xs font-semibold text-neutral-801">From</span>
                <LevelSelect testId="hierarchy-from" value={fromName} options={issueHierarchy} onChange={handleFrom} />
              </div>
              <div className="flex flex-col flex-1 gap-1">
                <span className="text-xs font-semibold text-neutral-801">To</span>
                <LevelSelect testId="hierarchy-to" value={toName} options={toOptions} onChange={handleTo} />
              </div>
            </div>
            <Checkbox
              testId="hierarchy-full"
              isChecked={isFull}
              onChange={(e) => handleShowFull(e.target.checked)}
              label="Show full hierarchy"
            />
          </div>
        )}
        trigger={(triggerProps) => (
          <button
            {...triggerProps}
            type="button"
            data-testid="hierarchy-trigger"
            className="inline-flex items-center gap-1 text-sm rounded bg-neutral-201 hover:bg-neutral-301 px-2 py-1 leading-4 cursor-pointer"
            onClick={() => setIsOpen((open) => !open)}
          >
            {summary}
            <ChevronDownIcon label="" />
          </button>
        )}
      />
    </ControlCell>
  );
};

export default SelectHierarchyRange;
