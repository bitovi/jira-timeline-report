/**
 * Build the "Explore children" URL for an issue popup: the current URL with `jql` scoped to the
 * issue, `loadChildren`/`childJQL` set to load its children, `loadBlockers`/`blockerJQL` reset, and
 * the report's active filters
 * (statuses/releases/grouping) cleared so the explore view isn't accidentally filtered out.
 *
 * Ports the legacy `exploreUrl` logic from `src/canjs/controls/issue-tooltip.js`.
 */
export const buildExploreUrl = (currentHref: string, issueKey: string): string => {
  const url = new URL(currentHref);
  url.searchParams.set('jql', 'issue = ' + issueKey);
  url.searchParams.set('loadChildren', 'true');
  url.searchParams.set('childJQL', '');
  // The explore view is scoped to ONE issue's children. Reset the blocker expansion too, or it is
  // inherited from whatever the current URL carried and drags a whole upstream graph in with it.
  url.searchParams.set('loadBlockers', 'false');
  url.searchParams.set('blockerJQL', '');
  url.searchParams.delete('statusesToShow');
  url.searchParams.delete('statusesToRemove');
  url.searchParams.delete('releasesToShow');
  url.searchParams.delete('groupBy');
  return url.href;
};
