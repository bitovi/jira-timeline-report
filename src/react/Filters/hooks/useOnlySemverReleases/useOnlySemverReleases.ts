import { useRouteData } from "../../../hooks/useRouteData";

export const useShowOnlySemverReleases = () => {
  const [showOnlySemverReleases, setShowOnlySemverReleases] = useRouteData<boolean>("showOnlySemverReleases")

  return { showOnlySemverReleases, setShowOnlySemverReleases };
};
