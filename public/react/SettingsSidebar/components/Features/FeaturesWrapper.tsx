import type { FC } from "react";

import React, { Suspense } from "react";
import { FlagsProvider } from "@atlaskit/flag";
import { ErrorBoundary } from "@sentry/react";
import { QueryClientProvider } from "@tanstack/react-query";
import Heading from "@atlaskit/heading";

import { StorageProvider } from "../../../services/storage";
import routeData from "../../../../canjs/routing/route-data";
import { queryClient } from "../../../services/query";
import Skeleton from "../../../components/Skeleton";
import Features from "./Features";

interface FeaturesWrapperProps {}

const FeaturesWrapper: FC<FeaturesWrapperProps> = () => {
  return (
    <div className="w-96">
      <FlagsProvider>
        <ErrorBoundary fallback={({ error }) => <FeaturesErrorBoundary error={error} />}>
          <Suspense fallback={<FeaturesSkeleton />}>
            <StorageProvider storage={routeData.storage}>
              <QueryClientProvider client={queryClient}>
                <Features />
              </QueryClientProvider>
            </StorageProvider>
          </Suspense>
        </ErrorBoundary>
      </FlagsProvider>
    </div>
  );
};

export default FeaturesWrapper;

const FeaturesSkeleton: FC = () => {
  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Features</Heading>
      </div>
      <div className="flex flex-col gap-y-8">
        <p className="text-sm">Turn on new features under active development.</p>
        <ul className="flex flex-col gap-y-8">
          {[...Array.from({ length: 4 }).keys()].map((i) => (
            <Skeleton key={i} height="44px" />
          ))}
        </ul>
        <p className="text-sm">
          Got feedback?{" "}
          <a href="#" className="link" target="_blank">
            Let us know on github.
          </a>
        </p>
      </div>
    </div>
  );
};

const FeaturesErrorBoundary: FC<{ error: unknown }> = ({ error }) => {
  if (
    !!error &&
    typeof error === "object" &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return <>{error?.message}</>;
  }

  return "Something went wrong, we are unable to load features";
};
