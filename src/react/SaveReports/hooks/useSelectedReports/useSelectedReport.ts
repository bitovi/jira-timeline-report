import type { Report, Reports } from '../../../../jira/reports';
import type { LayoutNode } from '../../../reports/ReportOfReports/model/sections';

import { useState } from 'react';
import { useQueryParams } from '../../../hooks/useQueryParams';
import { CanObservable } from '../../../hooks/useCanObservable';
import { useUpdateReport } from '../../../services/reports';
import { getReportFromParams, paramsMatchReport } from './utilities';
import { toStoredSections } from '../../../reports/ReportOfReports/model/sections';
import { storedQueryParams } from '../../storedQueryParams';
import routeData from '../../../../canjs/routing/route-data';

export const useSelectedReport = ({
  reports,
  queryParamObservable,
  sections = [],
}: {
  queryParamObservable: CanObservable<string>;
  reports: Reports;
  /**
   * The in-memory report-of-reports document tree, for {@link updateSelectedReport} to persist.
   * Empty for every other report type. Passed in rather than read from the layout context so this
   * hook stays independent of that provider. See spec/016-report-of-reports Phase 3.
   *
   * Not part of the dirty flag: a tree that differs from the saved one is a `sections` URL param
   * (spec/016-report-of-reports/006-url-state Phase 1), so `paramsMatchReport` already sees it.
   */
  sections?: LayoutNode[];
}) => {
  const { updateReport } = useUpdateReport();

  // Derived, not held in state. Saving writes the updated map straight into the query cache
  // (useSaveReports.tsx), so `reports` refreshes on the next render — but a `useState` snapshot
  // was only reassigned when the report *id* changed, leaving a stale record behind. That made the
  // `sections` comparison below run against the pre-save tree, so the dirty flag never cleared.
  // `useQueryParams` subscribes to the URL observable, so a URL change still re-renders.
  const selectedReport: Report | undefined = getReportFromParams(reports);

  const [paramsAreDirty, setParamsAreDirty] = useState(
    () => !paramsMatchReport(new URLSearchParams(window.location.search), reports),
  );

  useQueryParams(queryParamObservable, {
    onChange: (params) => {
      setParamsAreDirty(() => !paramsMatchReport(params, reports));
    },
  });

  return {
    selectedReport,
    updateSelectedReport: () => {
      if (!selectedReport) {
        console.warn('Tried to update the selectedReport without it being set');
        return;
      }

      const queryParams = new URLSearchParams(storedQueryParams(routeData.serialize()) as Record<string, string>);

      // Only report-of-reports has a tree, so omit the field entirely for every other type rather
      // than writing `sections: []` onto all of them. A document whose last node was removed still
      // needs the empty array written, or the spread in `updateReport` would keep the stale tree.
      const storedSections = toStoredSections(sections);
      const sectionsUpdate = storedSections.length || selectedReport.sections ? { sections: storedSections } : {};

      updateReport(
        selectedReport.id,
        { queryParams: queryParams.toString(), ...sectionsUpdate },
        {
          onSuccess: () => {
            setParamsAreDirty(false);

            queryParamObservable.set(`?report=${selectedReport.id}`);
          },
        },
      );
    },
    isDirty: paramsAreDirty,
  };
};
