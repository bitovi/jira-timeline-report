import type { FC } from 'react';

import React from 'react';
import Button from '@atlaskit/button/new';
import VisuallyHidden from '@atlaskit/visually-hidden';
import type { QuarterPreset } from './quarterPresets';

import { useDateRangeFilter } from '../../hooks/useDateRangeFilter';

const dateInputClassName = 'text-xs rounded bg-neutral-201 py-1 px-2 leading-3 hover:bg-neutral-301 cursor-pointer';

/**
 * Scatter Plot "Due date range" filter section — two native `<input type="date">` fields
 * ("From" / "To", mirroring the "Compare to" control's date input), a Clear button, and
 * quarter preset chips. Empty From/To mean "unbounded on that side", so leaving both empty
 * reproduces today's unfiltered behavior. Scoped to the scatter (`'due'`) report by the
 * caller ({@link Filters}).
 *
 * Rendered full-width (label as a section heading above the controls) rather than in the
 * narrow `FilterGrid` right cell: two native date inputs + Clear + preset chips need more
 * horizontal room than the ~278px cell offers, and squeezing them there overflowed the
 * dropdown. `flex-wrap` still guards against clipping at smaller widths.
 */
const DateRangeFilter: FC = () => {
  const { dateRangeStart, setDateRangeStart, dateRangeEnd, setDateRangeEnd, clearDateRange, applyPreset, presets } =
    useDateRangeFilter();

  const hasRange = dateRangeStart !== '' || dateRangeEnd !== '';

  return (
    <div>
      <p className="uppercase text-sm font-semibold text-zinc-800 pb-3">Due date range</p>
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <VisuallyHidden>
            <label htmlFor="date-range-filter-from">From</label>
          </VisuallyHidden>
          <input
            id="date-range-filter-from"
            type="date"
            className={dateInputClassName}
            value={dateRangeStart}
            onChange={(event) => setDateRangeStart(event.target.value)}
          />
          <span className="text-zinc-500">–</span>
          <VisuallyHidden>
            <label htmlFor="date-range-filter-to">To</label>
          </VisuallyHidden>
          <input
            id="date-range-filter-to"
            type="date"
            className={dateInputClassName}
            value={dateRangeEnd}
            onChange={(event) => setDateRangeEnd(event.target.value)}
          />
          <Button appearance="subtle" isDisabled={!hasRange} onClick={clearDateRange}>
            Clear
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {presets.map((preset: QuarterPreset) => {
            const isSelected = dateRangeStart === preset.from && dateRangeEnd === preset.to;
            return (
              <Button
                key={preset.label}
                appearance="subtle"
                spacing="compact"
                isSelected={isSelected}
                aria-pressed={isSelected}
                onClick={() => applyPreset(preset.from, preset.to)}
              >
                {preset.label}
              </Button>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default DateRangeFilter;
