import { useRouteData } from '../../hooks/useRouteData';

export const useSelectedIssueType = () => {
  const [primaryIssueType] = useRouteData<string>('primaryIssueType');
  const [secondaryIssueType] = useRouteData<string>('secondaryIssueType');

  const selectedIssueType = primaryIssueType === 'Release' ? secondaryIssueType : primaryIssueType;

  return { selectedIssueType, isRelease: primaryIssueType === 'Release' };
};
