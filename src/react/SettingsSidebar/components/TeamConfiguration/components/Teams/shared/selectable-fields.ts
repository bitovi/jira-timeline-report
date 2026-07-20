import type { IssueFields } from '../services/team-configuration';

export interface SelectableField {
  value: string;
  label: string;
}

/**
 * Build the `<Select>` options for the Jira fields.
 *
 * A field whose display name is unique keeps `value: name` (unchanged, name-based — no
 * migration for existing configs). A field whose display name is shared by another field
 * uses `value: id` and a disambiguated label so the user can tell the two apart and pick a
 * specific one. See spec/015-field-selection.
 */
export const buildSelectableFields = (jiraFields: IssueFields): SelectableField[] => {
  const nameCounts = new Map<string, number>();
  for (const { name } of jiraFields) {
    nameCounts.set(name, (nameCounts.get(name) ?? 0) + 1);
  }

  return jiraFields.map(({ name, id }) =>
    (nameCounts.get(name) ?? 0) > 1 ? { value: id, label: `${name} (${id})` } : { value: name, label: name },
  );
};
