import { defineFeatureFlag } from "./feature-flag";

const devConfigurationIssue = defineFeatureFlag(
  "devConfigurationIssue",
  "Changes the configuration issue",
  (value: string) => value,
  "Jira Timeline Report Configuration (Development)"
);

export const configurationIssueTitle = () => {
  const issue = devConfigurationIssue();

  if (issue === "dev") {
    return "Jira Timeline Report Configuration (Development)";
  }

  return issue ?? "Jira Auto Scheduler Configuration";
};
