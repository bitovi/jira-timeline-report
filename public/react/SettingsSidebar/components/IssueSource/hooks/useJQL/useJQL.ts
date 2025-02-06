import { useState } from "react";
import { value } from "../../../../../../can";
import routeData from "../../../../../../canjs/routing/route-data";
import { useCanObservable } from "../../../../../hooks/useCanObservable";

export const useJQL = () => {
  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, "jql"));
  const childJQLFromRouteData = useCanObservable(value.from<string>(routeData, "childJQL"));
  const loadChildren = useCanObservable(value.from<boolean>(routeData, "loadChildren"));
  const statusesToExcludeFromRouteData = useCanObservable(
    value.from<string[]>(routeData, "statusesToExclude")
  );

  const [statusesToExclude, setStatusesToExclude] = useState<string[]>(
    statusesToExcludeFromRouteData
  );
  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJQL, setChildJQL] = useState(childJQLFromRouteData);

  const applyJql = () => {
    routeData.assign({
      jql,
      childJQL,
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
    childJQL,
    setChildJQL,
    applyJql,
    statusesToExclude,
    setStatusesToExclude,
    applyButtonEnabled:
      jql !== jqlFromRouteData || childJQL !== childJQLFromRouteData || statusesDiffer,
  };
};
