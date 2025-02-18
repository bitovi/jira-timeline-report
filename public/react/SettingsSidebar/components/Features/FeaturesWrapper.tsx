import type { FC } from "react";

import React, { Suspense } from "react";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";

import { StorageProvider } from "../../../services/storage";
import routeData from "../../../../canjs/routing/route-data";
import { queryClient } from "../../../services/query";
import Features from "./Features";

interface FeaturesWrapperProps {}

const FeaturesWrapper: FC<FeaturesWrapperProps> = () => {
  return (
    <FlagsProvider>
      <ErrorBoundary>
        <Suspense fallback="loading...">
          <StorageProvider storage={routeData.storage}>
            <QueryClientProvider client={queryClient}>
              <Features />
            </QueryClientProvider>
          </StorageProvider>
        </Suspense>
      </ErrorBoundary>
    </FlagsProvider>
  );
};

export default FeaturesWrapper;
