import type { FC } from "react";
import type { ConfigureTeamsFormProps } from "./ConfigureTeamsForm";
import type { AppStorage } from "../../../../jira/storage/common";

import React, { Suspense } from "react";
import { ErrorBoundary } from "react-error-boundary";
import Spinner from "@atlaskit/spinner";

import ConfigureTeams, { ConfigureTeamsProps } from "./ConfigureTeams";
import { StorageProvider } from "../../services/storage";

export interface TeamConfigurationWrapperProps extends ConfigureTeamsProps {
  storage: AppStorage;
}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = ({ storage, ...props }) => {
  return (
    <ErrorBoundary fallbackRender={({ error }) => error?.message || "Something went wrong"}>
      <Suspense
        fallback={
          <div className="p-4 flex justify-center h-full items-center">
            <Spinner size="large" label="loading" />
          </div>
        }
      >
        <ConfigureTeams {...props} />
      </Suspense>
    </ErrorBoundary>
  );
};

export default TeamConfigurationWrapper;
