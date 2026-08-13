import { useQuery } from '@tanstack/react-query';

import { useJira } from '../jira';
import { reportsStorageKeys } from './key-factory';

export type SpaceIssueType = {
  id: string;
  name: string;
};

/**
 * By name, because the name is what gets stored and what `issuetype = "…"` matches. A space can
 * offer the same type name from more than one scheme; they are the same choice as far as this
 * setting is concerned.
 */
const dedupeByName = (issueTypes: SpaceIssueType[]): SpaceIssueType[] => {
  const byName = new Map<string, SpaceIssueType>();

  for (const issueType of issueTypes) {
    if (!byName.has(issueType.name)) {
      byName.set(issueType.name, issueType);
    }
  }

  return [...byName.values()];
};

/**
 * The work item types a saved report can become in `spaceName`.
 *
 * **Only ever this space's own list, never the site-wide catalog.** The endpoint answers with the
 * types *this user* can create *here*, so a failure is information rather than an inconvenience — it
 * is the first moment a space key that doesn't exist can be caught, long before Save. Falling back
 * to the site-wide catalog (as this hook first did) fills the dropdown with plausible types for a
 * space that isn't there, and lets someone pick a type the space doesn't accept: a mistake that
 * would then surface as a failed create halfway through a migration.
 *
 * Callers debounce `spaceName` — every distinct value is its own query key, so an undebounced field
 * asks Jira once per keystroke.
 */
export const useSpaceIssueTypes = (spaceName: string) => {
  const jira = useJira();
  const trimmed = spaceName.trim();

  const { data, isFetching, error } = useQuery({
    queryKey: reportsStorageKeys.spaceIssueTypes(trimmed),
    enabled: !!trimmed,
    // A space's work item types don't move, and the debounced field re-asks for a key it has
    // already resolved every time someone edits the tail of it and puts it back.
    staleTime: 5 * 60 * 1000,
    retry: false,
    queryFn: async (): Promise<SpaceIssueType[]> => {
      let issueTypes;

      try {
        const response = await jira.fetchProjectIssueTypes(trimmed);

        issueTypes = response?.issueTypes ?? [];
      } catch (cause) {
        console.warn(`[reports/storage] could not read the work item types of ${trimmed}`, cause);

        throw new Error(`Could not read "${trimmed}". Check the space key and that you have access to it.`);
      }

      const creatable = dedupeByName(
        issueTypes.filter((issueType) => !issueType.subtask).map(({ id, name }) => ({ id: String(id), name })),
      );

      // A reachable space with nothing in this list is a permissions answer, not an empty space —
      // and saving reports there would fail on the first create. Better to say so now.
      if (!creatable.length) {
        throw new Error(`You cannot create work items in "${trimmed}", so saved reports cannot be stored there.`);
      }

      return creatable;
    },
  });

  return { issueTypes: data ?? [], isLoading: isFetching, error: (error as Error | null) ?? null };
};
