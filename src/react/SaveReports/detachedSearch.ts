import type { Report } from '../../jira/reports';
import type { LayoutNode } from '../reports/ReportOfReports/model/sections';

import { SECTIONS_PARAM, encodeSections } from '../reports/ReportOfReports/model/documentParam';

/**
 * Params that describe the *page* rather than the report on it.
 *
 * Both spellings of the sidebar param are here: the URL key is `settings`, but saving writes
 * `routeData.serialize()`, which keys it by the property name `showSettings` — so a record saved
 * with the Sources panel open carries `showSettings=SOURCES` forever. Neither is ever read back off
 * a record (`fullscreen` has no saved-report fallback at all, and `showSettings` looks for the
 * record under the *other* key), so ignoring the record's copies is what leaves the page exactly as
 * the user has it. The URL's own copies are untouched — they're already in `params` below.
 *
 * `sections` is on the list because the record never stores a document there; it goes in the
 * `sections` *field*, which is written explicitly further down.
 *
 * Deliberately a copy of `PAGE_ONLY_KEYS` in `jira/reports/migrations/migrations.ts` rather than an
 * import: that list is frozen by hand so an already-shipped migration can't retroactively change
 * meaning, and importing it would also point `src/react` at a module that must not depend back.
 */
const PAGE_ONLY_KEYS = ['report', 'settings', 'showSettings', 'fullscreen', 'openAutoSchedulerModal', SECTIONS_PARAM];

/**
 * The query string that renders exactly what's on screen, minus the link to the saved report.
 *
 * While `?report=<id>` is present, the URL holds only the params that *differ* from the record —
 * everything else resolves from `reportData` (`makeParamAndReportDataReducer` in state-storage.js).
 * So dropping the id on its own would reset the report to defaults. Detaching has to inline the
 * record's contribution first, which is all this does:
 *
 * 1. the current URL wins, param for param — a param in it is an edit made on top of the saved
 *    report, and the live precedence keeps edits over saved values;
 * 2. every other param the record carries is filled in;
 * 3. page-only params from the record are ignored (see {@link PAGE_ONLY_KEYS});
 * 4. `report` is removed last, so a record that still carries its own id can't reinstate it.
 *
 * Pure, and takes the search as an argument rather than reading `window.location`, so the merge
 * rules are testable without a URL.
 */
export const detachedSearch = ({
  currentSearch,
  savedReport,
  sections = [],
}: {
  currentSearch: string;
  savedReport: Report;
  /**
   * The live report-of-reports tree. A document lives in the record's `sections` field, not in its
   * `queryParams` — `storedQueryParams.ts` stores only the report type for one — so this is the
   * only thing that can carry it across the detach. Without it `ReportLayoutProvider` sees neither
   * a `sections` param nor an open report and reads that as an empty document.
   */
  sections?: LayoutNode[];
}): string => {
  const params = new URLSearchParams(currentSearch);

  for (const [key, value] of new URLSearchParams(savedReport.queryParams)) {
    // An empty value round-trips as a bare `key=`, which every reader parses back to the default
    // anyway — so it would be pure URL weight.
    if (PAGE_ONLY_KEYS.includes(key) || params.has(key) || !value) {
      continue;
    }

    params.set(key, value);
  }

  if (sections.length && !params.has(SECTIONS_PARAM)) {
    params.set(SECTIONS_PARAM, encodeSections(sections));
  }

  params.delete('report');

  const search = params.toString();

  return search ? `?${search}` : '';
};
