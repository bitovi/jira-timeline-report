import { useSuspenseQuery } from "@tanstack/react-query";

import { useJira } from "./JiraProvider";
import { jiraKeys } from "./key-factory";

type IssueFields = Array<{
  name: string;
  key: string;
  schema: Record<string, string>;
  id: string;
  custom: boolean;
  clauseNames: string[];
  searchable: boolean;
  navigable: boolean;
  orderable: boolean;
}>;

export type UseJiraIssueFields = () => IssueFields;

export const useJiraIssueFields: UseJiraIssueFields = () => {
  const { fetchJiraFields } = useJira();

  const { data } = useSuspenseQuery({
    queryKey: jiraKeys.allIssueFields(),
    queryFn: async () => {
      // TODO fix types here
      return fetchJiraFields() as unknown as IssueFields;
    },
  });

  return data;
};
