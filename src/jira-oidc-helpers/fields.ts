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

export function makeFieldsRequest(config: Config, setFieldsRequest: (req: FieldsRequest) => void) {
  // Note: we intentionally check hasAccessToken() (presence) rather than hasValidAccessToken()
  // (presence + not expired). The request helpers (hosted/connect) already refresh an expired
  // token before making the request, so gating on validity here just meant that on page load
  // with an expired-but-refreshable token, this request would never even be kicked off, leaving
  // fieldsRequest permanently undefined until the next full page load. See mapIdsToNames crash.
  if (config.host === 'jira' || hasAccessToken()) {
    const req = fetchJiraFields(config)().then((fieldsPassed) => {
      const fields = fieldsPassed as unknown as Array<{ name: string; id: string }>;

      const nameMap: Record<string, any> = {};
      const idMap: Record<string, any> = {};

      const idToFields: Record<string, Array<{ name: string; id: string; scope?: string }>> = {};

      fields.forEach((f) => {
        // @ts-ignore
        idMap[f.id] = f.name;
        // @ts-ignore
        if (!idToFields[f.name]) {
          idToFields[f.name] = [];
        }
        idToFields[f.name].push(f);
      });

      for (let fieldName in idToFields) {
        idToFields[fieldName].sort(fieldPriorityOrder);
        nameMap[fieldName] = idToFields[fieldName][0].id;
      }

      return {
        list: fields,
        nameMap: nameMap,
        idMap: idMap,
      };
    });

    setFieldsRequest(req as any);
  }
}
