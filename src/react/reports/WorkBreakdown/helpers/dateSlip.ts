import type { DateSlip, LastPeriod } from '../types';
import { DAY_IN_MS } from '../../../../utils/date/date-helpers.js';
import { formatDate } from './formatDate';

/** The rollup/work-type slice `dateSlip` reads. */
export interface SlipInput {
  status?: string;
  due?: Date | null;
  lastPeriod?: LastPeriod | null;
}

/**
 * Compare a rollup's current due date against the prior period:
 *
 * - status `'ahead'` with a prior date → `'improved'` (pulled earlier; shown teal).
 * - current due later than the prior period (by more than a day) → `'slipped'` (shown red).
 * - otherwise → `'none'`.
 *
 * Ports the legacy `wasReleaseDate`; the `label` is the formatted prior-period date.
 */
export const dateSlip = (rollup: SlipInput): DateSlip => {
  const was = rollup.lastPeriod?.due ?? null;
  const current = rollup.due ?? null;

  if (rollup.status === 'ahead' && was) {
    return { kind: 'improved', label: formatDate(was) };
  }
  if (was && current && current.getTime() - DAY_IN_MS > was.getTime()) {
    return { kind: 'slipped', label: formatDate(was) };
  }
  return { kind: 'none' };
};
