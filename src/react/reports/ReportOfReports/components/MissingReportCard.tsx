import type { FC, ReactNode } from 'react';

import React from 'react';

export interface MissingReportCardProps {
  /** Id of the saved report the document points at. Shown so the user can identify what went. */
  reportId: string;
  /** The node's reorder / remove controls. */
  controls?: ReactNode;
}

/**
 * Stands in for a `saved-report` node whose report is gone — deleted from the Saved Reports page, or
 * never visible to this user. The rest of the document renders normally around it, and the node is
 * kept (not silently dropped), so saving doesn't quietly discard it and restoring the report brings
 * the child back. See spec/016-report-of-reports Phase 4.
 */
export const MissingReportCard: FC<MissingReportCardProps> = ({ reportId, controls }) => (
  <div
    data-testid="missing-report"
    data-report-id={reportId}
    className="border border-dashed border-neutral-301 rounded p-4 print-avoid-break"
  >
    <div className="flex items-start gap-4 pb-2">
      <h3 className="text-base font-semibold text-slate-500">Report not found</h3>
      {controls}
    </div>
    <p className="text-slate-500">
      {'This report was deleted, or is not available to you. Remove it from the document, or restore the saved report '}
      <code className="font-mono text-sm">{reportId}</code>
      {'.'}
    </p>
  </div>
);

export default MissingReportCard;
