/**
 * Type-aware filter control for a single column (spec/012-table-and-grouper, Phase 1, design §5).
 *
 * Given a column's {@link FilterDescriptor} `kind`, renders the matching input(s) and reports the
 * current {@link FilterValue} up via `onChange`. All filter UX lives inside the column's `⋯` menu —
 * there is no separate filter bar (plan Q6).
 */
import React from 'react';
import Textfield from '@atlaskit/textfield';
import { Checkbox } from '@atlaskit/checkbox';

import type { FilterDescriptor } from '../../model/columns';
import type { FilterValue } from '../../model/applyView';

interface FilterControlProps {
  descriptor: FilterDescriptor;
  value: FilterValue | undefined;
  onChange: (value: FilterValue | undefined) => void;
  /** Distinct values observed in the data — used to populate the `select` control. */
  options?: string[];
}

export const FilterControl: React.FC<FilterControlProps> = ({ descriptor, value, onChange, options = [] }) => {
  switch (descriptor.kind) {
    case 'text': {
      const current = value?.kind === 'text' ? value.contains : '';
      return (
        <Textfield
          testId="table-filter-text"
          placeholder="Contains…"
          value={current}
          onChange={(e) => onChange({ kind: 'text', contains: (e.target as HTMLInputElement).value })}
        />
      );
    }

    case 'number': {
      const current = value?.kind === 'number' ? value : { min: undefined, max: undefined };
      const emit = (patch: Partial<{ min?: number; max?: number }>) =>
        onChange({ kind: 'number', min: current.min, max: current.max, ...patch });
      const toNum = (raw: string) => (raw === '' ? undefined : Number(raw));
      return (
        <div className="flex gap-2">
          <Textfield
            testId="table-filter-number-min"
            type="number"
            placeholder="Min"
            value={current.min ?? ''}
            onChange={(e) => emit({ min: toNum((e.target as HTMLInputElement).value) })}
          />
          <Textfield
            testId="table-filter-number-max"
            type="number"
            placeholder="Max"
            value={current.max ?? ''}
            onChange={(e) => emit({ max: toNum((e.target as HTMLInputElement).value) })}
          />
        </div>
      );
    }

    case 'date': {
      const current = value?.kind === 'date' ? value : { from: undefined, to: undefined };
      const emit = (patch: Partial<{ from?: string; to?: string }>) =>
        onChange({ kind: 'date', from: current.from, to: current.to, ...patch });
      const toStr = (raw: string) => (raw === '' ? undefined : raw);
      return (
        <div className="flex gap-2">
          <Textfield
            testId="table-filter-date-from"
            type="date"
            value={current.from ?? ''}
            onChange={(e) => emit({ from: toStr((e.target as HTMLInputElement).value) })}
          />
          <Textfield
            testId="table-filter-date-to"
            type="date"
            value={current.to ?? ''}
            onChange={(e) => emit({ to: toStr((e.target as HTMLInputElement).value) })}
          />
        </div>
      );
    }

    case 'select': {
      const selected = value?.kind === 'select' ? value.selected : [];
      const toggle = (option: string, checked: boolean) => {
        const next = checked ? [...selected, option] : selected.filter((s) => s !== option);
        onChange({ kind: 'select', selected: next });
      };
      if (options.length === 0) {
        return <div className="text-neutral-801 text-xs">No values to filter.</div>;
      }
      return (
        <div className="max-h-48 overflow-auto flex flex-col gap-1">
          {options.map((option) => (
            <Checkbox
              key={option}
              testId="table-filter-select-option"
              label={option}
              isChecked={selected.includes(option)}
              onChange={(e) => toggle(option, (e.target as HTMLInputElement).checked)}
            />
          ))}
        </div>
      );
    }

    case 'boolean': {
      const current = value?.kind === 'boolean' ? value.value : undefined;
      return (
        <div className="flex flex-col gap-1">
          <Checkbox
            testId="table-filter-boolean-true"
            label="Is true"
            isChecked={current === true}
            onChange={(e) =>
              onChange((e.target as HTMLInputElement).checked ? { kind: 'boolean', value: true } : undefined)
            }
          />
          <Checkbox
            testId="table-filter-boolean-false"
            label="Is false"
            isChecked={current === false}
            onChange={(e) =>
              onChange((e.target as HTMLInputElement).checked ? { kind: 'boolean', value: false } : undefined)
            }
          />
        </div>
      );
    }

    default:
      return null;
  }
};

export default FilterControl;
