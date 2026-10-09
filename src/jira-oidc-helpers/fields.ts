/**
 * this module gets available jira fields.
 */

import { hasAccessToken } from './auth';
import { Config, FieldsRequest } from './types';

export function fetchJiraFields(config: Config) {
  return () => {
    return config.requestHelper(`/api/3/field`);
  };
}

function fieldPriorityOrder(
  a: { name: string; id: string; scope?: string },
  b: { name: string; id: string; scope?: string },
) {
  if (a?.scope && !b?.scope) {
    return 1;
  }
  if (b?.scope && !a?.scope) {
    return -1;
  }

  return 0;
}

/**
 * Stable names for the system fields the app reads by name (`fields['Issue Type']`, etc.), so a Jira
 * rename (e.g. "Linked Issues" → "Linked work items") or a translated UI can't break those reads.
 *
 * Not ideal: this is a patch over reading fields by display name at all. The robust fix is to read
 * system fields by id (`fields.issuetype`) throughout. It also means field pickers show these names
 * instead of Jira's current labels. Custom fields (Team, Sprint, Rank, …) have per-site ids and can't
 * be pinned here.
 */
const PINNED_SYSTEM_FIELD_NAMES: Record<string, string> = {
  summary: 'Summary',
  description: 'Description',
  issuetype: 'Issue Type',
  status: 'Status',
  parent: 'Parent',
  created: 'Created',
  duedate: 'Due date',
  labels: 'Labels',
  fixVersions: 'Fix versions',
  assignee: 'Assignee',
  issuelinks: 'Linked Issues',
};

/**
 * Build the name↔id maps from the raw Jira field list.
 *
 * `nameMap` (name → id) collapses each display name to a single id via `fieldPriorityOrder`.
 * `ambiguousFieldIds` records the ids of every field whose display name is shared by more
 * than one field, so `mapIdsToNames` can keep those fields in distinct, non-colliding slots
 * rather than overwriting each other under the single shared name key. See
 * spec/015-field-selection.
 */
export function deriveFieldMaps(fields: Array<{ name: string; id: string; scope?: string }>) {
  const nameMap: Record<string, string> = {};
  const idMap: Record<string, string> = {};
  const idToFields: Record<string, Array<{ name: string; id: string; scope?: string }>> = {};
  const ambiguousFieldIds = new Set<string>();

  fields.forEach((f) => {
    const name = PINNED_SYSTEM_FIELD_NAMES[f.id] ?? f.name;
    idMap[f.id] = name;
    (idToFields[name] ??= []).push(f);
  });

  for (const fieldName in idToFields) {
    idToFields[fieldName].sort(fieldPriorityOrder);
    nameMap[fieldName] = idToFields[fieldName][0].id;

    if (idToFields[fieldName].length > 1) {
      for (const f of idToFields[fieldName]) {
        ambiguousFieldIds.add(f.id);
      }
    }
  }

  return { nameMap, idMap, ambiguousFieldIds };
}

export function makeFieldsRequest(config: Config, setFieldsRequest: (req: FieldsRequest) => void) {
  // Note: we intentionally check hasAccessToken() (presence) rather than hasValidAccessToken()
  // (presence + not expired). The request helpers (hosted/connect) already refresh an expired
  // token before making the request, so gating on validity here just meant that on page load
  // with an expired-but-refreshable token, this request would never even be kicked off, leaving
  // fieldsRequest permanently undefined until the next full page load. See mapIdsToNames crash.
  if (config.host === 'jira' || hasAccessToken()) {
    const req = fetchJiraFields(config)().then((fieldsPassed) => {
      const fields = fieldsPassed as unknown as Array<{ name: string; id: string }>;

      return {
        list: fields,
        ...deriveFieldMaps(fields),
      };
    });

    setFieldsRequest(req as any);
  }
}
