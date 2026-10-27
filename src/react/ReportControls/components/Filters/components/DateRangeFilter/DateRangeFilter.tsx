import type { FC } from 'react';

import React from 'react';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { getDateRangePresets } from './quarterPresets';

const dateInputClassName =
  'min-w-0 flex-1 text-sm rounded border border-neutral-50 bg-white py-1.5 px-2 text-neutral-800 hover:border-neutral-100 focus:border-blue-400 focus:outline-none cursor-pointer';

const pillClassName = (isSelected: boolean) =>
  `rounded-full border px-3 py-1 text-sm font-medium ${
    isSelected
      ? 'border-blue-400 bg-blue-101 text-blue-400'
      : 'border-neutral-50 bg-white text-neutral-801 hover:border-neutral-100'
  }`;

export interface DateRangeFilterProps {
  /** ISO `YYYY-MM-DD`; empty means unbounded on that side. */
  start: string;
  end: string;
  onChange: (start: string, end: string) => void;
  /** Prefixes the input ids so several ranges (one per Filters panel tab) can coexist. */
  idPrefix?: string;
  /** The Filters panel renders its own section heading. */
  hideHeading?: boolean;
  /** The Filters panel puts Clear in its section heading instead. */
  hideClear?: boolean;
}

/**
 * "Due date range" filter section — two native `<input type="date">` fields ("From" / "To",
 * mirroring the "Compare to" control's date input), a Clear button, and quarter preset pills.
 * Empty From/To mean "unbounded on that side", so leaving both empty reproduces today's
 * unfiltered behavior. Shared by the Scatter Plot (`'due'`) and Gantt Chart (`'start-due'`)
 * reports in the Filters dropdown, and by every tab of the Filters panel.
 *
 * Rendered full-width (label as a section heading above the controls) rather than in the
 * narrow `FilterGrid` right cell: two native date inputs + Clear + preset pills need more
 * horizontal room than the ~278px cell offers. `flex-wrap` still guards against clipping.
 */
const DateRangeFilter: FC<DateRangeFilterProps> = ({
  start,
  end,
  onChange,
  idPrefix = 'date-range-filter',
  hideHeading,
  hideClear,
}) => {
  const hasRange = start !== '' || end !== '';
  const presets = getDateRangePresets();

  return (
    <div>
      {!hideHeading && <p className="uppercase text-sm font-semibold text-zinc-800 pb-3">Due date range</p>}
      <div className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <VisuallyHidden>
            <label htmlFor={`${idPrefix}-from`}>From</label>
          </VisuallyHidden>
          <input
            id={`${idPrefix}-from`}
            type="date"
            className={dateInputClassName}
            value={start}
            onChange={(event) => onChange(event.target.value, end)}
          />
          <span className="text-neutral-200">–</span>
          <VisuallyHidden>
            <label htmlFor={`${idPrefix}-to`}>To</label>
          </VisuallyHidden>
          <input
            id={`${idPrefix}-to`}
            type="date"
            className={dateInputClassName}
            value={end}
            onChange={(event) => onChange(start, event.target.value)}
          />
          {!hideClear && (
            <button
              type="button"
              className="shrink-0 text-sm font-medium text-blue-400 hover:underline disabled:text-neutral-100 disabled:no-underline"
              disabled={!hasRange}
              onClick={() => onChange('', '')}
            >
              Clear
            </button>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset) => {
            const isSelected = start === preset.from && end === preset.to;
            return (
              <button
                key={preset.label}
                type="button"
                className={pillClassName(isSelected)}
                aria-pressed={isSelected}
                onClick={() => onChange(preset.from, preset.to)}
              >
                {preset.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DateRangeFilter;
