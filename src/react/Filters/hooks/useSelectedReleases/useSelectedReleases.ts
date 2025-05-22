import type { MinimalDerivedIssue } from '../../../services/issues';

import { value } from '../../../../can';
import routeData from '../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../hooks/useCanObservable';
import { useDerivedIssues } from '../../../services/issues';

export const useSelectedReleases = () => {
  const releases = useSelectableReleases();

  const selectedReleases = useCanObservable<string>(value.from(routeData, 'releasesToShow'));

  const setSelectedReleases = (newReleases: Readonly<{ value: string }[]> | { value: string }[]) => {
    //@ts-expect-error
    routeData.releasesToShow = newReleases.map(({ value }) => value);
  };

  return {
    releases,
    selectedReleases: convertToSelectValue(selectedReleases) ?? [],
    setSelectedReleases,
  };
};

const useSelectableReleases = () => {
  const derivedIssues = useDerivedIssues();

  return getReleasesFromDerivedIssues(derivedIssues || []);
};

const getReleasesFromDerivedIssues = (derivedIssues: MinimalDerivedIssue[]) => {
  const releases = [...new Set(derivedIssues.map(({ releases }) => releases.map(({ name }) => name)).flat(1))];

  return releases.map((release) => ({
    label: release,
    value: release,
  }));
};

const convertToSelectValue = (selectedReleases: string) => {
  const decoded = decodeURIComponent(selectedReleases);
  const members = decoded.split(',').filter(Boolean);

  if (!members.length) {
    return undefined;
  }

  return members.map((member) => ({
    label: member,
    value: member,
  }));
};
