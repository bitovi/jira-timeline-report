/**
 * this module gets available jira fields.
 */

import { hasValidAccessToken } from "./auth";
import { Config, FieldsRequest } from "./types";

export function fetchJiraFields(config: Config) {
  return () => {
    return config.requestHelper(`/api/3/field`);
  };
}

function fieldPriorityOrder(
  a: { name: string; id: string; scope?: string },
  b: { name: string; id: string; scope?: string }
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
  if (config.host === "jira" || hasValidAccessToken()) {
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

      fields.forEach((f) => {
        idMap[f.id] = f.name;
        nameMap[f.name] = f.id;
      });

      return {
        list: fields,
        nameMap: nameMap,
        idMap: idMap,
      };
    });

    setFieldsRequest(req as any);
  }
}
