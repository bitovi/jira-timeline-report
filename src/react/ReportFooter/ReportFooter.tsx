import React, { FC } from 'react';

import StatusKey from './components/StatusKey';
import AutoSchedulerFooter from './components/AutoSchedulerFooter';
import { PrimaryReportType, usePrimaryReportType } from '../ReportControls/hooks/usePrimaryReportType';

const reportFooterMap: Partial<Record<PrimaryReportType, FC>> = {
  'auto-scheduler': AutoSchedulerFooter,
  'start-due': StatusKey,
};

/**
 * Report types whose sticky footer needs the report body to reserve bottom clearance below it.
 *
 * The sticky `#report-footer` div (`TimelineReport.tsx`) always mounts, but its content
 * (`reportFooterMap` above) is empty for most report types. A `sticky bottom-0` element still
 * occupies its normal-flow position, so without a gap directly above it, its content visually covers
 * whatever of the report scrolls underneath once it pins to the viewport bottom.
 *
 * Deliberately narrower than "has footer content" (`reportFooterMap`'s own keys): `start-due` (Gantt)
 * is the one report whose own component used to carry a `mb-10` for exactly this. `auto-scheduler`
 * also renders a non-null footer (`AutoSchedulerFooter`) but never had that margin and isn't known to
 * need it — its own report doesn't scroll under the sticky footer the same way — so it's left out
 * rather than assumed to need the same treatment.
 */
const REPORT_TYPES_NEEDING_FOOTER_CLEARANCE = new Set<PrimaryReportType>(['start-due']);

/**
 * Whether `primaryReportType`'s sticky footer needs the report body above it to reserve bottom
 * clearance (see {@link REPORT_TYPES_NEEDING_FOOTER_CLEARANCE}). `TimelineReport` applies the margin
 * to `#react-report-container` when this is true, rather than each report component carrying its own
 * copy of a margin that, for most of them, isn't protecting against anything.
 */
export const reportNeedsFooterClearance = (primaryReportType: string): boolean =>
  REPORT_TYPES_NEEDING_FOOTER_CLEARANCE.has(primaryReportType as PrimaryReportType);

const ReportFooter: FC = () => {
  const [primaryReportType] = usePrimaryReportType();

  const Footer = reportFooterMap[primaryReportType];

  if (!Footer) {
    return null;
  }

  return <Footer />;
};

export default ReportFooter;
