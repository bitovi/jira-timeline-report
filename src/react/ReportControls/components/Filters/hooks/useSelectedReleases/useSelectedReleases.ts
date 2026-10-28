import type { MinimalDerivedIssue } from '../../../../../services/issues';
import { useDerivedIssues } from '../../../../../services/issues';

/** Every release name on the loaded issues, as Select options for the Releases tab. */
export const useSelectableReleases = () => {
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
