import type { MinimalDerivedIssue } from "../../shared/hooks/useDerivedIssues";

import { useDerivedIssues } from "../../shared/hooks/useDerivedIssues";

export const useSelectedReleases = () => {
  const releases = useSelectableReleases();

  const setSelectedReleases = (
    newReleases: Readonly<{ value: string }[]> | { value: string }[]
  ) => {
    //@ts-expect-error
    routeData.releasesToShow = newReleases.map(({ value }) => value).join(",");
  };

  return { releases, setSelectedReleases };
};

const useSelectableReleases = () => {
  const derivedIssues = useDerivedIssues();

  return getReleasesFromDerivedIssues(derivedIssues || []);
};

const getReleasesFromDerivedIssues = (derivedIssues: MinimalDerivedIssue[]) => {
  const releases = derivedIssues.map(({ releases }) => releases.map(({ name }) => name)).flat(1);

  return releases.map((release) => ({
    label: release,
    value: release,
  }));
};
