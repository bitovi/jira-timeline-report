import type { FC } from 'react';
import type { ItemLabel } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

import React from 'react';

import { WORK_ITEMS_LABEL } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

interface TrackStepperProps {
  value: number;
  onChange: (next: number) => void;
  isDisabled?: boolean;
  /** What the team works on in parallel — the scheduled level's name, e.g. "Epic" / "Epics". */
  itemLabel?: ItemLabel;
}

const stepButton =
  'w-[22px] border-none bg-white text-slate-600 font-mono text-[13px] leading-none cursor-pointer ' +
  'hover:bg-neutral-20 disabled:text-neutral-50 disabled:cursor-not-allowed';

/**
 * Both directions in one control, unlike the original tool which put `+` on the team row and `−` on
 * the first track's label row. That row is not rendered when a track has no work — exactly when you
 * would want to remove it.
 */
export const TrackStepper: FC<TrackStepperProps> = ({
  value,
  onChange,
  isDisabled = false,
  itemLabel = WORK_ITEMS_LABEL,
}) => (
  <span className="inline-flex h-[22px] items-stretch overflow-hidden rounded-[3px] border border-neutral-40 bg-white">
    <button
      type="button"
      className={stepButton}
      disabled={isDisabled || value <= 1}
      title={`Work on one fewer ${itemLabel.singular} in parallel.`}
      aria-label={`Work on one fewer ${itemLabel.singular} in parallel`}
      onClick={() => onChange(value - 1)}
    >
      −
    </button>
    <span
      aria-live="polite"
      className="inline-flex min-w-[56px] items-center justify-center whitespace-nowrap border-x border-neutral-30 px-1 text-[11px] font-semibold text-slate-600"
    >
      {value} {value === 1 ? itemLabel.singular : itemLabel.plural} in parallel
    </span>
    {/* No upper bound: how many streams a team runs is a fact about the team, not ours to cap. */}
    <button
      type="button"
      className={stepButton}
      disabled={isDisabled}
      title={`Work on one more ${itemLabel.singular} in parallel.`}
      aria-label={`Work on one more ${itemLabel.singular} in parallel`}
      onClick={() => onChange(value + 1)}
    >
      +
    </button>
  </span>
);
