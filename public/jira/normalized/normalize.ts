interface IssueFields {
  Confidence: number;
  "Due date": string;
  "Issue Type": { hierarchyLevel: number; name: string };
  "Parent Link": { data: { key: string } };
  "Project Key": string;
  "Start date": string;
  Status: { name: string; statusCategory: { name: string } };
  "Story points": number;
  "Story points median": number;
  "Story points confidence": number;
  Summary: string;
}

interface JiraIssue {
  fields: Partial<IssueFields>;
  id: string;
  key: string;
}

export function getConfidenceDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Story points confidence" | "Confidence"] | undefined {
  return fields["Story points confidence"] || fields.Confidence;
}

export function getDueDateDefault({ fields }: Pick<JiraIssue, "fields">): IssueFields["Due date"] | undefined {
  return fields?.["Due date"];
}

export function getHierarchyLevelDefault({
  fields,
}: Pick<JiraIssue, "fields">): IssueFields["Issue Type"]["hierarchyLevel"] | undefined {
  return fields["Issue Type"]?.hierarchyLevel;
}
