interface IssueFields {
  Confidence: number;
  "Due date": string | null;
  "Issue Type": { hierarchyLevel: number; name: string };
  "Parent Link": { data: { key: string } };
  "Project Key": string;
  "Start date": string | null;
  Status: { name: string; statusCategory: { name: string } };
  "Story points": number | null | undefined;
  "Story points median": number | null | undefined;
  "Story points confidence": number | null;
  Summary: string;
}

interface JiraIssue {
  fields: Partial<IssueFields>;
  id: string;
  key: string;
}

export function getConfidenceDefault({ fields }: Pick<JiraIssue, 'fields'>): number | undefined {
  return fields["Story points confidence"] || fields?.Confidence;
}
