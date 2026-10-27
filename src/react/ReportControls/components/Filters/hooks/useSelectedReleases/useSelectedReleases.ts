import type { MinimalDerivedIssue } from '../../../../../services/issues';
import { useDerivedIssues } from '../../../../../services/issues';
import { useRouteData } from '../../../../../hooks/useRouteData';
import { useReportOnLevelFilter } from '../useLevelFilter';

export const useSelectedReleases = () => {
  const releases = useSelectableReleases();

  const { filter, hasOwnEntry, setFilter } = useReportOnLevelFilter();
  const [, setLegacySelectedReleases] = useRouteData<string, string[]>('releasesToShow');

  const handleSelectedReleasesChange = (newReleases: Readonly<{ value: string }[]> | { value: string }[]) => {
    const releasesToShow = newReleases.map(({ value }) => value);
    if (hasOwnEntry) {
      setFilter({ ...filter, releasesToShow });
    } else {
      setLegacySelectedReleases(releasesToShow);
    }
  };

  return {
    releases,
    selectedReleases: convertToSelectValue((filter.releasesToShow ?? []).join(',')) ?? [],
    setSelectedReleases: handleSelectedReleasesChange,
  };
};

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
