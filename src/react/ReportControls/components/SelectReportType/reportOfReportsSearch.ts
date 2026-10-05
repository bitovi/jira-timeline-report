/**
 * Params that describe the *page* rather than the report on it, so they survive the switch — the
 * open sidebar stays open, fullscreen stays fullscreen.
 */
const PAGE_KEYS = ['settings', 'fullscreen'];

/**
 * The query string for turning the open saved report into a report-of-reports: a detach plus a
 * clean URL.
 *
 * A saved report of any other type can't become a report-of-reports in place — saving would
 * overwrite the record with a different kind of report. So the switch detaches: `report` is left
 * out, which leaves an unsaved report that gets a fresh id when it's saved, and the saved one stays
 * as it was.
 *
 * Unlike the Detach button (`detachedSearch`), none of the record's settings are inlined. Detach
 * has to carry them because it keeps the same report on screen; this starts a different one. A
 * report-of-reports reads none of them — every section is configured from its own saved
 * `queryParams` (`ChildReportConfig`), and the document is the same type-only bag
 * `storedQueryParams` saves for one — so carried over they'd only be dead weight in the URL.
 */
export const reportOfReportsSearch = (currentSearch: string): string => {
  const current = new URLSearchParams(currentSearch);
  const params = new URLSearchParams();

  for (const key of PAGE_KEYS) {
    const value = current.get(key);

    if (value) {
      params.set(key, value);
    }
  }

  params.set('primaryReportType', 'report-of-reports');

  return `?${params.toString()}`;
};
