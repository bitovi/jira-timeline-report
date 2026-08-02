/**
 * The report type a config asks for that this build cannot render — or `undefined` when it can.
 *
 * Deliberately works on **raw** params rather than `routeData.primaryReportType`. Route-data clamps
 * an unrecognized report type to the first entry in `REPORTS` (`route-data.js`, and
 * `ChildReportConfig.js` for embedded children), so the parsed value is always a real report type:
 * a saved report carrying a dead key like `table2` renders a Gantt over its JQL with nothing to
 * indicate it was saved as something else. That clamp is worth keeping — a report type saved by a
 * *newer* client should degrade to a chart rather than refuse to render — so the raw value is what
 * has to be inspected to tell the two cases apart.
 *
 * Precedence mirrors `proposeValueFromState` (`state-storage.js`): the URL wins over the saved
 * report, and an absent or empty value means "the default", which is always renderable.
 *
 * See spec/018-card-report/saved-report-migrations/plan.md § End of life 2.
 */
export function unsupportedReportType({
  urlParams,
  savedReport,
  knownReportTypes,
}: {
  /** The page's params. Omitted by embedded children, which never read the page URL. */
  urlParams?: URLSearchParams;
  savedReport?: { queryParams?: string } | null;
  knownReportTypes: readonly string[];
}): string | undefined {
  const fromUrl = urlParams?.get('primaryReportType') ?? null;
  const fromSavedReport = savedReport?.queryParams
    ? new URLSearchParams(savedReport.queryParams).get('primaryReportType')
    : null;

  const raw = fromUrl ?? fromSavedReport;

  if (!raw || knownReportTypes.includes(raw)) {
    return undefined;
  }

  return raw;
}
