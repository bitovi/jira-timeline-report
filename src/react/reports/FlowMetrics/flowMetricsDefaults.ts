export const EXCLUDED_STATUSES_BY_DEFAULT = new Set(['canceled', 'cancelled', 'blocked', 'on hold']);

export const EXCLUDED_ISSUE_TYPES_BY_DEFAULT = new Set(['epic', 'initiative', 'milestone', 'outcome']);

/**
 * Returns the filter to apply. Uses the stored value if the user has made an explicit
 * selection; otherwise computes defaults by excluding known non-flow types from the
 * available options. Returns undefined when no filtering is needed (all pass).
 */
export function computeEffectiveFilter(
  rawFilter: string[] | undefined,
  options: string[],
  excluded: Set<string>,
): string[] | undefined {
  if (rawFilter?.length) return rawFilter;
  if (!options.length) return undefined;
  const included = options.filter((o) => !excluded.has(o.toLowerCase()));
  return included.length < options.length ? included : undefined;
}
