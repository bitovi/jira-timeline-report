import type { FC, ReactNode } from "react";
import type { Jira } from "../../../jira-oidc-helpers";

import React, { createContext, useContext } from "react";

type JiraContextValues = Jira | null;

const JiraContext = createContext<JiraContextValues>(null);

export const useJira = () => {
  const storage = useContext(JiraContext);

  if (!storage) {
    throw new Error("Cannot use useJira outside of its provider");
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
