import type { FC, ReactNode } from "react";
import React, { createContext, useContext } from "react";

// TODO: Move type to module
import jiraOidcHelpers from "../../../../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;

type JiraContextValues = Jira | null;

const JiraContext = createContext<JiraContextValues>(null);

export const useJira = () => {
  const storage = useContext(JiraContext);

  if (!storage) {
    throw new Error("Cannot use useStorage outside of its provider");
  }

  return storage;
};

interface JiraProviderProps {
  jira: Jira;
  children: ReactNode;
}

export const JiraProvider: FC<JiraProviderProps> = ({ jira, children }) => {
  return <JiraContext.Provider value={jira}>{children}</JiraContext.Provider>;
};
