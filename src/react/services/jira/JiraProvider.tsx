import type { FC, ReactNode } from "react";
import type { Jira } from "../../../jira-oidc-helpers";

import React, { createContext, useContext } from "react";

type JiraContextValues = Jira | null;

const JiraContext = createContext<JiraContextValues>(null);

export const useJira = () => {
  const jira = useContext(JiraContext);

  if (!jira) {
    throw new Error("Cannot use useJira outside of its provider");
  }

  return jira;
};

interface JiraProviderProps {
  jira: Jira;
  children: ReactNode;
}

export const JiraProvider: FC<JiraProviderProps> = ({ jira, children }) => {
  return <JiraContext.Provider value={jira}>{children}</JiraContext.Provider>;
};
