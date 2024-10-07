export type History = {
    id: string;
    change: string;
};
export type ChangeLog = {
    histories: History[];
    maxResults: number;
    total: number;
    startAt: number;
}
export type JiraIssue = {
    id: string;
    key: string;
    fields: Record<string, any>;
    changelog?: ChangeLog;
};
export type InterimJiraIssue = {
    id: string;
    key: string;
    fields: Record<string, any>;
    changelog?: History[];
};