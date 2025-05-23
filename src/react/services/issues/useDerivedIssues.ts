import { value } from '../../../can';
import routeData from '../../../canjs/routing/route-data';
import { useCanObservable } from '../../hooks/useCanObservable';

export type MinimalDerivedIssue = {
  status: string;
  type: string;
  team: { name: string };
  releases: Array<{ name: string }>;
};

export const useDerivedIssues = () => {
  const derivedIssues = useCanObservable<MinimalDerivedIssue[] | undefined>(value.from(routeData, 'derivedIssues'));

  return derivedIssues;
};
