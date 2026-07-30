import type { FC } from 'react';

import React from 'react';

export interface MissingReportNoteProps {
  /** Id of the saved report the document points at. Shown so the user can identify what went. */
  reportId: string;
}

/**
 * What a `saved-report` node whose report is gone renders instead of a chart — deleted from the Saved
 * Reports page, or never visible to this user. The row above it says "Report not found"; this is the
 * explanation that follows, in the place the chart would have been.
 *
 * The rest of the document renders normally around it, and the node is kept (not silently dropped),
 * so saving doesn't quietly discard it and restoring the report brings the child back.
 * See spec/016-report-of-reports Phase 4, and .../004-redesign §1 for why it's no longer a card.
 */
export const MissingReportNote: FC<MissingReportNoteProps> = ({ reportId }) => (
  <p className="px-2 pb-2 text-sm text-slate-500">
    {'This report was deleted, or is not available to you. Remove it from the document, or restore the saved report '}
    <code className="font-mono text-sm">{reportId}</code>
    {'.'}
  </p>
);

export default MissingReportNote;
