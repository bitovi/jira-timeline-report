import type { DerivedIssue } from '../../../../jira/derived/derive';

/**
 * Builds a map of { [statusName]: statusCategoryName } from all issues in the dataset.
 * Used to look up the category for historical statuses that may differ from any issue's current status.
 */
export function buildStatusCategoryMap(issues: DerivedIssue[]): Record<string, string> {
  const map: Record<string, string> = {};

  for (const issue of issues) {
    if (issue.status && issue.statusCategory) {
      map[issue.status] = issue.statusCategory;
    }

    // Also harvest categories from the raw changelog toString/field data isn't enough;
    // pull from the raw Status field on each issue for a richer map.
    const statusField = issue.issue.fields['Status'];
    if (statusField && typeof statusField === 'object' && 'name' in statusField && 'statusCategory' in statusField) {
      const s = statusField as { name: string; statusCategory: { name: string } };
      if (s.name && s.statusCategory?.name) {
        map[s.name] = s.statusCategory.name;
      }
    }
  }

  return map;
}
