import { getQuartersAndMonths } from './quarters-and-months';
import { getDaysInMonth } from './days-in-month';

export interface Month {
  date: Date;
  name: string;
  daysInMonth: number;
  number: number;
  first?: boolean;
  last?: boolean;
}

export interface Quarter {
  name: string;
  number: number;
}

export interface QuartersAndMonths {
  quarters: Quarter[];
  months: Month[];
  firstDay: Date;
  lastDay: Date;
}

/**
 * Compute quarter and month headers spanning a date range.
 *
 * Wraps the existing {@link getQuartersAndMonths} and augments each month with an
 * accurate `daysInMonth` (used for grid column widths). Uses `getFullYear()` — not the
 * legacy `getYear()` (year − 1900), which is wrong for century years like 2000.
 */
export const computeQuartersAndMonths = (startDate: Date, endDate: Date): QuartersAndMonths => {
  const { quarters, months, firstDay, lastDay } = getQuartersAndMonths(startDate, endDate);

  const monthsWithDays: Month[] = months.map((month) => ({
    ...month,
    daysInMonth: getDaysInMonth(month.date.getFullYear(), month.date.getMonth() + 1),
  }));

  return { quarters, months: monthsWithDays, firstDay, lastDay };
};
