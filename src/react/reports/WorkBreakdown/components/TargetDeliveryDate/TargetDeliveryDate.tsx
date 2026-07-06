import React from 'react';
import type { DateSlip } from '../../types';
import { formatDate } from '../../helpers';

export interface TargetDeliveryDateProps {
  /** Heading text shown before the date. Defaults to `Target Delivery`. */
  label?: string;
  /** The current rolled-up date. */
  due?: Date | null;
  /** Slip direction + prior-period label; renders a red (slipped) or teal (improved) parenthetical. */
  slip: DateSlip;
}

/**
 * A labeled delivery date with slip styling — shared by both secondary views. A slipped date shows
 * the prior (earlier) date in red; an "improved"/ahead date shows the prior (later) date in teal.
 */
export const TargetDeliveryDate: React.FC<TargetDeliveryDateProps> = ({ label = 'Target Delivery', due, slip }) => {
  const slipColor = slip.kind === 'improved' ? 'color-text-ahead' : 'color-text-blocked';

  return (
    <div className="flex flex-row items-baseline gap-1.5">
      <b className="text-neutral-800">{label}</b>
      <span className="nowrap font-medium text-neutral-300">{formatDate(due) || '—'}</span>
      {slip.kind !== 'none' && slip.label ? (
        <span className={`nowrap font-medium ${slipColor}`}>({slip.label})</span>
      ) : null}
    </div>
  );
};
