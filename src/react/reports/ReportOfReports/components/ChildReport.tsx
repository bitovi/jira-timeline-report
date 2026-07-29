import type { FC, ComponentType } from 'react';
import type { Report } from '../../../../jira/reports';
import type { ReportLoadingState } from '../../../TimelineReport/hooks/useReportLoadingState';

import React, { useMemo } from 'react';

import routeData from '../../../../canjs/routing/route-data';
import { TimelineReportViewModel } from '../../../TimelineReport/timeline-report-view-model';
import { useReportLoadingState } from '../../../TimelineReport/hooks/useReportLoadingState';
import { ErrorMessage } from '../../../TimelineReport/components/ReportMessages';
import { LoadingProgressContainer } from '../../../TimelineReport/components/LoadingProgress';
import { embeddableReportComponents } from '../../registry';
import { propsFor } from '../../reportProps';
import { ChildReportConfig } from '../model/ChildReportConfig';

// can.js classes carry placeholder (.js) types that declare no constructor arguments; cast the two
// we instantiate, mirroring the `rd`/`vm` casts in TimelineReport.tsx.
const ConfigClass = ChildReportConfig as any;
const ViewModelClass = TimelineReportViewModel as any;

export interface ChildReportProps {
  /** The saved report being embedded. Its `queryParams` is the child's entire configuration. */
  report: Report;
  /**
   * The shared `routeData` singleton. Children read the genuinely global properties off it — Jira
   * metadata and team configuration — rather than recomputing them. Injectable for tests.
   */
  parent?: any;
  /** The report registry. Injectable for tests (default-prop dependency injection). */
  components?: Record<string, ComponentType<any>>;
  /** Loading-state hook, driven by the child's own request. Injectable for tests. */
  useLoadingState?: (config: any) => ReportLoadingState;
}

/**
 * Renders one embedded report inside a report-of-reports.
 *
 * Each child builds its own {@link ChildReportConfig} from its saved `queryParams`, its own
 * {@link TimelineReportViewModel} on top of that config, and its own prop bag via `propsFor` — so
 * two children with different JQLs show different data on one page. The report component itself is
 * unchanged; it can't tell it isn't the shell's primary report.
 *
 * Unlike the shell, a child has no empty-result gate: the shell's "check your JQL and the View
 * Settings" message points at controls a child doesn't have, so an empty child renders as its own
 * (empty) report. See spec/016-report-of-reports Phase 2.
 */
const ChildReportView: FC<ChildReportProps> = ({
  report,
  parent = routeData,
  components = embeddableReportComponents,
  useLoadingState = useReportLoadingState,
}) => {
  const config: any = useMemo(
    () => new ConfigClass({ queryParams: report.queryParams, parent }),
    [report.queryParams, parent],
  );

  const vm: any = useMemo(() => new ViewModelClass({ routeData: config }), [config]);
  const props = useMemo(() => propsFor(vm, config), [vm, config]);

  // Called unconditionally so an injected hook still obeys the rules of hooks.
  const loadingState = useLoadingState(config);

  const reportType: string = config.primaryReportType;

  // No nesting in v1. `selectableReports` already keeps one out of the picker; this is the
  // backstop for a hand-edited or newer-client document.
  if (reportType === 'report-of-reports') {
    return <ChildMessage>A Report of Reports cannot be embedded inside another one.</ChildMessage>;
  }

  const PrimaryReport = components[reportType];

  if (!PrimaryReport) {
    return <ChildMessage>{`Unknown report type "${reportType}".`}</ChildMessage>;
  }

  if (loadingState.status === 'rejected') {
    return (
      <ErrorMessage
        noLicense={loadingState.rejectReason?.type === 'no-licensing'}
        errorMessage={loadingState.rejectReason?.errorMessages?.[0]}
      />
    );
  }

  if (loadingState.status === 'pending') {
    return <LoadingProgressContainer loadingState={loadingState} />;
  }

  return <PrimaryReport {...props} />;
};

/**
 * Memoized because the document re-renders on every hover change — `Document` consumes the
 * `DocumentEditing` context, so moving the pointer from one row to the next rebuilds the whole
 * element tree. No report component under `src/react/reports` is memoized, so without this each row
 * crossing reconciles every embedded chart's entire subtree; a Gantt of a few hundred issues is
 * thousands of nodes. Charts are the expensive part of a document, and they cannot change as a
 * result of a hover.
 *
 * A shallow compare is enough: `report` comes from the saved-reports query cache, and the three
 * injectable props are test seams that production never passes.
 */
export const ChildReport = React.memo(ChildReportView);

ChildReport.displayName = 'ChildReport';

const ChildMessage: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-4 text-slate-500">{children}</p>
);

export default ChildReport;
