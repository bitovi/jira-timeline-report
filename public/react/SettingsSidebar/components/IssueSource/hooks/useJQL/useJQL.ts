import { useState } from "react";
import { value } from "../../../../../../can";
import routeData from "../../../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../../../hooks/useCanObservable";

export const useJQL = () => {
  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, "jql"));
  const childJqlFromRouteData = useCanObservable(value.from<string>(routeData, "childJql"));
  const statusesToExcludeFromRouteData = useCanObservable(
    value.from<string[]>(routeData, "statusesToExclude")
  );
  const loadChildren = useCanObservable(value.from<boolean>(routeData, "loadChildren"));
  const setLoadChildren = (newLoad: boolean) => {
    routeData.loadChildren = newLoad;
  };

  const [statusesToExclude, setStatusesToExclude] = useState<string[]>(
    statusesToExcludeFromRouteData
  );
  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJql, setChildJql] = useState(childJqlFromRouteData);

  const applyJql = () => {
    routeData.assign({
      jql,
      childJQL: childJql,
      statusesToExclude,
    });
  };

  const statusesDiffer =
    statusesToExclude.some((filter) => !statusesToExcludeFromRouteData.includes(filter)) ||
    statusesToExcludeFromRouteData.some((filter) => !statusesToExclude.includes(filter));

  return {
    loadChildren,
    jql,
    setJql,
    childJql,
    setChildJql,
    applyJql,
    statusesToExclude,
    setStatusesToExclude,
    setLoadChildren,
    applyButtonEnabled:
      !jql || jql !== jqlFromRouteData || childJql !== childJqlFromRouteData || statusesDiffer,
  };
};
