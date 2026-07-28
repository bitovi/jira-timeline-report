import type { ComponentType } from 'react';

import { embeddableReportComponents } from './registry';
import ReportOfReports from './ReportOfReports/ReportOfReportsWrapper';

/**
 * Every report the shell can render as the page's primary report: the embeddable ones plus
 * `report-of-reports`, which composes them.
 *
 * Kept separate from `registry.ts` so that `ChildReport` — which needs the embeddable map — doesn't
 * pull in `ReportOfReports`, which renders `ChildReport`. Only the shell imports this module.
 * See spec/016-report-of-reports Phase 2.
 */
export const reportComponents: Record<string, ComponentType<any>> = {
  ...embeddableReportComponents,
  // Takes none of the `*Obs` props — it composes other saved reports, each of which owns its own
  // config and fetch.
  'report-of-reports': ReportOfReports,
};
