import React from "react";
import type { FC } from "react";

import type { NormalizedIssue } from "../../../jira/normalized/normalize";

interface ConfigureTeamsProps {
  normalizedIssues: Array<NormalizedIssue>;
}
const ConfigureTeams: FC<ConfigureTeamsProps> = () => {
  return <h1>Hello World</h1>;
};

export default ConfigureTeams;
