import type { ComponentType } from 'react';

import { WorkBreakdown } from './WorkBreakdown';
import { EstimateAnalysis } from './EstimateAnalysis/EstimateAnalysis';
import AutoScheduler from './AutoScheduler/AutoScheduler';
import EstimationProgress from './EstimationProgress/EstimationProgress';
import { GroupingReport } from './GroupingReport/GroupingReport';
import { FlowMetrics } from './FlowMetrics/FlowMetrics';
import { TimeInStatus } from './TimeInStatus/TimeInStatus';
import { ScatterTimeline } from './ScatterTimeline';
import { GanttGrid } from './GanttReport/GanttGrid';
import { TableReport } from './TableReport/TableReport';

/**
 * URL `primaryReportType` → the React report that renders it, for every report that can be
 * *embedded* in a report-of-reports. Typed loosely (each report takes its own subset of the shared
 * `*Obs` bag) — matches the untyped `createElement` registry the StacheElement used. This is the
 * seam for future `React.lazy` code-splitting
 * (see spec/011-react-rewrite/timeline-report/progressive-loading.md).
 *
 * It lives in its own module rather than in `TimelineReport` because looking a report type up now
 * happens from *inside* a report (`ChildReport`), and keeping the map in the shell would make the
 * shell import a report that imports the shell.
 *
 * `report-of-reports` is deliberately absent — a document can't nest inside another one, and
 * including it here would put this module in a cycle with `ChildReport`. The shell's superset lives
 * in `shellRegistry.ts`. See spec/016-report-of-reports Phase 2.
 */
export const embeddableReportComponents: Record<string, ComponentType<any>> = {
  'estimate-analysis': EstimateAnalysis,
  'auto-scheduler': AutoScheduler,
  'estimation-progress': EstimationProgress,
  grouper: GroupingReport,
  'flow-metrics': FlowMetrics,
  'time-in-status': TimeInStatus,
  due: ScatterTimeline,
  'start-due': GanttGrid,
  table2: TableReport,
};

/** The secondary (Work Breakdown) report, rendered below a Gantt or Scatter primary. */
export { WorkBreakdown };
