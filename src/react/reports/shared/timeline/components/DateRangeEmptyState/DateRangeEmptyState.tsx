import React from 'react';

/**
 * Shown in place of the timeline grid when an active "Due date range" filter excludes every
 * dated issue — otherwise the report renders as a bare axis with no rows and no explanation.
 *
 * Shared by the Scatter Plot and the Gantt Chart, the two reports that offer the range filter.
 * The copy speaks of due dates because both reports match on the rolled-up due date only
 * (spec/004-scatter-improvements/date-range.md Questions #2).
 */
export const DateRangeEmptyState: React.FC = () => (
  <div className="flex items-center justify-center text-center text-neutral-500 text-sm py-16 border border-dashed border-neutral-80 rounded">
    No issues are due in the selected date range.
  </div>
);
