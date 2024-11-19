import { defineFeatureFlag } from "./feature-flag";

const devConfigurationIsse = defineFeatureFlag(
  "devConfigurationIssue",
  "Toggles the application's configuration issue between prod and dev",
  false
);

export const configurationIssueTitle = () => {
  if (devConfigurationIsse()) {
    return "Jira Timeline Report Configuration (Development)";
  }

  return "Jira Auto Scheduler Configuration";
};
