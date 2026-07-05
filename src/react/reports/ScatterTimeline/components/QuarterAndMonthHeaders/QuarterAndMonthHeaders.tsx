import React from 'react';
import type { Quarter, Month } from '../../types';

export interface QuarterAndMonthHeadersProps {
  quarters: Quarter[];
  months: Month[];
}

/**
 * Quarter and month header cells for the scatter grid.
 *
 * Rendered as direct CSS-grid children: each quarter spans three columns on row 1; each
 * month occupies one column on row 2. Must be placed inside the report's grid container.
 */
export const QuarterAndMonthHeaders: React.FC<QuarterAndMonthHeadersProps> = ({ quarters, months }) => (
  <>
    {quarters.map((quarter, index) => (
      <div key={`q-${quarter.name}-${index}`} style={{ gridColumn: 'span 3' }} className="text-center">
        {quarter.name}
      </div>
    ))}
    {months.map((month, index) => (
      <div
        key={`m-${index}`}
        style={{ gridColumn: `${index + 1} / span 1`, gridRow: '2 / span 1' }}
        className="border-b border-neutral-80 text-center"
      >
        {month.name}
      </div>
    ))}
  </>
);
