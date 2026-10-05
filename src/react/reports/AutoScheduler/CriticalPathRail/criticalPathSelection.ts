import type { PathFrequency } from '../scheduler/critical-path-accumulator';

export type CriticalPathSelection = { kind: 'epic'; key: string } | { kind: 'route'; id: string } | null;

/** Matches `CriticalPathAccumulator.addIteration` — a separator that cannot occur in a Jira key. */
export function routeId(keys: string[]): string {
  return keys.join('\u0000');
}

export function isRouteLit(selection: CriticalPathSelection, route: PathFrequency): boolean {
  if (!selection) return false;
  if (selection.kind === 'route') return routeId(route.keys) === selection.id;
  return route.keys.includes(selection.key);
}

/**
 * Deliberately asymmetric with `isRouteLit`: an epic selection lights only routes, never other
 * epics. The epics table is a ranking, and dimming it would destroy the comparison the user
 * selected the row in order to make.
 */
export function isEpicLit(selection: CriticalPathSelection, epicKey: string, routes: PathFrequency[]): boolean {
  if (!selection) return false;
  if (selection.kind === 'epic') return selection.key === epicKey;
  const route = routes.find((candidate) => routeId(candidate.keys) === selection.id);
  return route ? route.keys.includes(epicKey) : false;
}

/** The Gantt highlight set for a selection, or null to clear it. */
export function highlightKeysForSelection(
  selection: CriticalPathSelection,
  routes: PathFrequency[],
): Set<string> | null {
  if (!selection) return null;

  if (selection.kind === 'route') {
    const route = routes.find((candidate) => routeId(candidate.keys) === selection.id);
    return route ? new Set(route.keys) : null;
  }

  const keys = new Set<string>();
  for (const route of routes) {
    if (!route.keys.includes(selection.key)) continue;
    for (const key of route.keys) keys.add(key);
  }
  // An epic that never reached the critical path highlights only itself, so the grid never blanks.
  if (keys.size === 0) keys.add(selection.key);
  return keys;
}
