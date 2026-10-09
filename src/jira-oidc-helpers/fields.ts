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
 * System fields the app reads by display name, pinned to the name the code expects. Jira's
 * "issues → work items" rename changes these display names per site (e.g. `issuelinks` became
 * "Linked work items"), which silently dropped the field from requests and responses.
 */
const CANONICAL_SYSTEM_FIELD_NAMES: Record<string, string> = {
  issuelinks: 'Linked Issues',
  issuetype: 'Issue Type',
  parent: 'Parent',
  status: 'Status',
  created: 'Created',
  labels: 'Labels',
  fixVersions: 'Fix versions',
  duedate: 'Due date',
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
    idMap[f.id] = f.name;
    (idToFields[f.name] ??= []).push(f);
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

  // The site's current display name stays in `nameMap` as an alias.
  for (const f of fields) {
    const canonicalName = CANONICAL_SYSTEM_FIELD_NAMES[f.id];
    if (canonicalName) {
      idMap[f.id] = canonicalName;
      nameMap[canonicalName] = f.id;

      // Another field already displayed under the canonical name (e.g. a custom "Linked Issues"
      // once `issuelinks` is "Linked work items") is a name collision: both keep their raw-id slot,
      // and the system field owns the name — the other field drops out of `idMap` so it can't
      // overwrite it in `mapIdsToNames`.
      for (const other of idToFields[canonicalName] ?? []) {
        if (other.id !== f.id) {
          ambiguousFieldIds.add(f.id);
          ambiguousFieldIds.add(other.id);
          delete idMap[other.id];
        }
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
