import type { DerivedIssue } from '../../../jira/derived/derive';

// The shape that metrics.ts functions expect from a Jira issue.
// Bridges two structural differences between jira-timeline-report's JiraIssue
// and the metrics functions' expected input.
export interface MetricsIssue {
  key: string;
  url?: string;
  projectKey: string;
  fields: {
    resolutiondate: string | null;
  };
  changelog: {
    histories: Array<{
      id: string;
      created: string;
      items: Array<{
        field: string;
        from: string | null;
        to: string | null;
        fromString: string | null;
        toString: string | null;
      }>;
    }>;
  };
}

type ChangelogEntry = {
  created: string;
  items: Array<{ field: string; to?: string }>;
};

// Jira's statusCategory always has a `key` field ('new' | 'indeterminate' | 'done')
// in the API response, but the local Status type only declares statusCategory.name.
// We read it at runtime and fall back to name-matching for safety.
function readCategoryKey(statusCategory: { name: string }): string {
  const cat = statusCategory as { name: string; key?: string };
  if (cat.key) return cat.key;
  switch (cat.name) {
    case 'Done':
      return 'done';
    case 'In Progress':
      return 'indeterminate';
    default:
      return 'new';
  }
}

// Builds a status ID → category key ('new' | 'indeterminate' | 'done') map
// by scanning both current statuses and every changelog status transition.
//
// Two-pass approach:
// 1. Current statuses give us a reliable id → category AND name → category seed.
// 2. Changelog items only carry status ID + name (not category). For IDs not seen
//    as a current status we look up the name in the name map built in pass 1.
//    This handles statuses like "Backlog" that no issue is currently sitting in.
export function buildStatusCategoryMap(derivedIssues: DerivedIssue[]): Map<string, string> {
  const idMap = new Map<string, string>(); // status ID   → category key
  const nameMap = new Map<string, string>(); // status name → category key

  // Pass 1: seed from current statuses — these have the full statusCategory object.
  for (const { issue } of derivedIssues) {
    const status = issue.fields.Status;
    if (status?.id) {
      const key = readCategoryKey(status.statusCategory);
      idMap.set(status.id, key);
      nameMap.set(status.name, key);
    }
  }

  // Pass 2: fill in any status IDs that appear only in changelog history.
  // fromString / toString are the status names at the time of the transition —
  // use them to look up a category via the name map from pass 1.
  for (const { issue } of derivedIssues) {
    for (const entry of issue.changelog ?? []) {
      for (const item of entry.items) {
        if (item.field !== 'status') continue;
        if (item.from && item.fromString && !idMap.has(item.from)) {
          const category = nameMap.get(item.fromString);
          if (category) idMap.set(item.from, category);
        }
        if (item.to && item.toString && !idMap.has(item.to)) {
          const category = nameMap.get(item.toString);
          if (category) idMap.set(item.to, category);
        }
      }
    }
  }

  return idMap;
}

// Derives the done date from changelog transitions rather than resolutiondate.
// resolutiondate is not included in CORE_FIELDS and is therefore not fetched.
//
// Returns the LAST transition into a done status category, matching the behaviour
// of Jira's resolutiondate field which updates each time an issue is re-resolved.
// Using the first done transition would give a date earlier than the last
// in-progress date for re-opened issues, producing a zero or negative cycle time.
function getDoneDateFromChangelog(changelog: ChangelogEntry[], statusCategoryMap: Map<string, string>): string | null {
  const sorted = [...changelog].sort((a, b) => new Date(a.created).getTime() - new Date(b.created).getTime());
  let result: string | null = null;
  for (const entry of sorted) {
    for (const item of entry.items) {
      if (item.field !== 'status' || !item.to) continue;
      if (statusCategoryMap.get(item.to) === 'done') {
        result = entry.created;
      }
    }
  }
  return result;
}

// Converts DerivedIssue[] to the shape metrics.ts functions expect.
// Differences bridged:
// 1. changelog is a flat array here; metrics.ts expects { histories: [...] }
// 2. resolutiondate is not fetched; derived from the first done status
//    transition in the changelog instead
export function toMetricsIssues(derivedIssues: DerivedIssue[], statusCategoryMap: Map<string, string>): MetricsIssue[] {
  return derivedIssues.map(({ issue, projectKey, url }) => {
    const histories = (issue.changelog ?? []).map((entry) => ({
      id: '',
      created: entry.created,
      items: entry.items.map((item) => ({
        field: item.field,
        from: item.from ?? null,
        to: item.to ?? null,
        fromString: item.fromString ?? null,
        toString: item.toString ?? null,
      })),
    }));

    return {
      key: issue.key,
      url,
      projectKey,
      fields: {
        resolutiondate: getDoneDateFromChangelog(issue.changelog ?? [], statusCategoryMap),
      },
      changelog: {
        histories,
      },
    };
  });
}
