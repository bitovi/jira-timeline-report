import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";
import type { AppStorage } from "../../../jira/storage/common";

import React, { Suspense } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "react-error-boundary";
import Heading from "@atlaskit/heading";

import ConfigureTeams from "./ConfigureTeams";
import { StorageProvider } from "./services/storage";
import { Accordion, AccordionContent, AccordionTitle } from "../../components/Accordion";

// TODO: Move type to module
import jiraOidcHelpers from "../../../jira-oidc-helpers";
type Jira = ReturnType<typeof jiraOidcHelpers>;
import { JiraProvider } from "./services/jira";

const queryClient = new QueryClient();

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {
  storage: AppStorage;
  jira: Jira;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ storage, jira, ...props }) => {
  return (
    <div className="w-96">
      <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
        <Suspense fallback="...loading">
          <QueryClientProvider client={queryClient}>
            <FlagsProvider>
              <JiraProvider jira={jira}>
                <StorageProvider storage={storage}>
                  <Accordion>
                    <AccordionTitle>
                      <Heading size="small">Global default</Heading>
                    </AccordionTitle>
                    <AccordionContent>
                      <ConfigureTeams {...props} />
                    </AccordionContent>
                  </Accordion>
                </StorageProvider>
              </JiraProvider>
            </FlagsProvider>
          </QueryClientProvider>
        </Suspense>
      </ErrorBoundary>
    </div>
  );
};

export default TeamConfigurationWrapper;
