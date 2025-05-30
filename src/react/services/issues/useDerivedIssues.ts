import { useRouteData } from '../../hooks/useRouteData';

export type MinimalDerivedIssue = {
  status: string;
  type: string;
  team: { name: string };
  releases: Array<{ name: string }>;
};

export const useDerivedIssues = (): MinimalDerivedIssue[] | undefined => {
  const [derivedIssues] = useRouteData<MinimalDerivedIssue[] | undefined>('derivedIssues');

  return derivedIssues;
};
