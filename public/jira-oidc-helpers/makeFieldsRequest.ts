import { hasValidAccessToken } from "./auth";
import { Config } from "./types";

export function fetchJiraFields(config: Config) {
    return () => {
        return config.requestHelper(`/api/3/field`);
    };
}

export function makeFieldsRequest(config: Config) {
    if (config.host === "jira" || hasValidAccessToken()) {
    return fetchJiraFields(config)().then((fields) => {
        const nameMap: Record<string, any> = {};
        const idMap: Record<string, any> = {};
        // @ts-ignore
        fields.forEach((f) => {
            // @ts-ignore
            idMap[f.id] = f.name;
            // @ts-ignore
            nameMap[f.name] = f.id;
        });
        console.log(nameMap);

        return {
            list: fields,
            nameMap: nameMap,
            idMap: idMap,
        };
    });
}
}