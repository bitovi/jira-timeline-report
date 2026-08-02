import type { FC, ComponentType } from 'react';
import type { Report } from '../../../../jira/reports';
import type { ReportLoadingState } from '../../../TimelineReport/hooks/useReportLoadingState';

import React, { useEffect, useMemo } from 'react';

import routeData from '../../../../canjs/routing/route-data';
import { TimelineReportViewModel } from '../../../TimelineReport/timeline-report-view-model';
import { useReportLoadingState } from '../../../TimelineReport/hooks/useReportLoadingState';
import { ErrorMessage } from '../../../TimelineReport/components/ReportMessages';
import { unsupportedReportType } from '../../../TimelineReport/unsupportedReportType';
import { LoadingProgressContainer } from '../../../TimelineReport/components/LoadingProgress';
import { reports as REPORTS } from '../../../../configuration/reports';
import { embeddableReportComponents } from '../../registry';
import { propsFor } from '../../reportProps';
import { ChildReportConfig } from '../model/ChildReportConfig';
import { childOverrideValue, mergeChildQuery } from '../model/childParams.js';
import { useChildFieldsOverride } from './ChildQueryGroups';

// can.js classes carry placeholder (.js) types that declare no constructor arguments; cast the two
// we instantiate, mirroring the `rd`/`vm` casts in TimelineReport.tsx.
const ConfigClass = ChildReportConfig as any;
const ViewModelClass = TimelineReportViewModel as any;

// Every report type any build of this app offers — the same catalog ChildReportConfig clamps against.
const KNOWN_REPORT_TYPES = REPORTS.map((report) => report.key);

export interface ChildReportProps {
  /**
   * The saved report being embedded. Its `queryParams`, plus {@link overrides}, is the child's
   * entire configuration.
   */
  report: Report;
  /**
   * This child's node's configuration overrides — a query-string fragment of only the keys that
   * differ from the saved report's own. A string rather than an object so it can be compared and
   * memoized by value, and so the merged result is still a query string.
   */
  overrides?: string;
  /**
   * Called `(key, serialized)` when the report writes a setting, with `undefined` for "no value".
   * The document records it on this child's node. Must be referentially stable — this component is
   * memoized precisely so a document doesn't reconcile every embedded chart on every hover.
   * See spec/016-report-of-reports/006-url-state Phase 2.
   */
  onParamChange?: (key: string, serialized: string | undefined) => void;
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
  overrides,
  onParamChange,
  parent = routeData,
  components = embeddableReportComponents,
  useLoadingState = useReportLoadingState,
}) => {
  // What this child is actually configured to do: what it was saved with, plus whatever has been
  // changed inside it since. Everything downstream reads this rather than `report.queryParams`, or
  // it would silently disagree with what the child renders.
  const queryParams: string = useMemo(
    () => mergeChildQuery(report.queryParams, overrides),
    [report.queryParams, overrides],
  );

  // An override records only what *differs* from the saved report, so a value the report writes
  // back to what it was saved with clears the override instead of pinning it — the same rule
  // `updateUrlParam` follows for every other setting, and what keeps a sort toggled there and back
  // from leaving a permanently dirty document. The child owns this comparison because it is the
  // only thing here that knows its own saved `queryParams`.
  const handleParamChange = useMemo(
    () =>
      onParamChange &&
      ((key: string, serialized: string | undefined) =>
        onParamChange(key, childOverrideValue(report.queryParams, key, serialized))),
    [report.queryParams, onParamChange],
  );

  // When the document found other embedded reports asking Jira the same question, this is the union
  // of the fields that group between them needs — so all of them send an identical request and
  // `getRawIssues` collapses the cascades onto one. `null` outside a document, or when nothing else
  // shares this query.
  const tableColumnFieldsOverride = useChildFieldsOverride(queryParams);

  // The override belongs in these deps, and it MUST be referentially stable — a fresh array each
  // render would rebuild the config, and with it the child's whole fetch, on every render of a
  // document that re-renders on every hover. `ChildQueryGroupsProvider` memoizes the roster and
  // `useChildFieldsOverride` memoizes by content for exactly this reason.
  //
  // `queryParams` is read here but deliberately NOT a dependency: it changes on every in-report
  // edit, and rebuilding the config would restart the child's whole fetch cascade on every column
  // sort. It is a live observable prop instead, reassigned by the effect below — which re-resolves
  // every setting from the new string without touching `rawIssuesRequestData`, since that only
  // recomputes when the query or the field list actually changes.
  const config: any = useMemo(
    () => new ConfigClass({ queryParams, parent, tableColumnFieldsOverride, onParamChange: handleParamChange }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [report.queryParams, parent, tableColumnFieldsOverride, handleParamChange],
  );

  useEffect(() => {
    if (config.queryParams !== queryParams) {
      config.queryParams = queryParams;
    }
  }, [config, queryParams]);

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

  // `config.primaryReportType` is clamped to a real report type (ChildReportConfig.js), so the
  // `!PrimaryReport` backstop below can't see a dead key — a child saved as `table2` would render a
  // Gantt instead. Check the raw saved value for that, same as the shell does. Compared against the
  // report *catalog*, not the injected registry, so an incomplete registry still falls through to the
  // backstop below rather than being reported as a dead saved format.
  const deadReportType = unsupportedReportType({
    savedReport: report,
    knownReportTypes: KNOWN_REPORT_TYPES,
  });

  if (deadReportType) {
    return (
      <ChildMessage>
        {`This report was saved in a format we no longer support — it refers to a report type "${deadReportType}" that no longer exists.`}
      </ChildMessage>
    );
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
 * A shallow compare is enough: `report` comes from the saved-reports query cache, `overrides` is a
 * string, `onParamChange` is stable for the layout provider's lifetime, and the three injectable
 * props are test seams that production never passes.
 */
export const ChildReport = React.memo(ChildReportView);

ChildReport.displayName = 'ChildReport';

const ChildMessage: FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="p-4 text-slate-500">{children}</p>
);

export default ChildReport;
