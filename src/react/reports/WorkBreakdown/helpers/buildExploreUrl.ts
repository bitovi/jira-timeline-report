/**
 * Build the "Explore children" URL for an issue popup: the current URL with `jql` scoped to the
 * issue, `loadChildren`/`childJQL` set to load its children, and the report's active filters
 * (statuses/releases/grouping) cleared so the explore view isn't accidentally filtered out.
 *
 * Ports the legacy `exploreUrl` logic from `src/canjs/controls/issue-tooltip.js`.
 */
export const buildExploreUrl = (currentHref: string, issueKey: string): string => {
  const url = new URL(currentHref);
  url.searchParams.set('jql', 'issue = ' + issueKey);
  url.searchParams.set('loadChildren', 'true');
  url.searchParams.set('childJQL', '');
  url.searchParams.delete('statusesToShow');
  url.searchParams.delete('statusesToRemove');
  url.searchParams.delete('releasesToShow');
  url.searchParams.delete('groupBy');
  return url.href;
};
