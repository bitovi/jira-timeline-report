import { value } from "../../../can";
import routeData from "../../../canjs/routing/route-data";
import { useCanObservable } from "../../hooks/useCanObservable";

export const useSelectedIssueType = () => {
  const primaryIssueType = useCanObservable<string>(value.from(routeData, "primaryIssueType"));
  const secondaryIssueType = useCanObservable<string>(value.from(routeData, "secondaryIssueType"));

  const selectedIssueType = primaryIssueType === "Release" ? secondaryIssueType : primaryIssueType;

  return { selectedIssueType, isRelease: primaryIssueType === "Release" };
};
