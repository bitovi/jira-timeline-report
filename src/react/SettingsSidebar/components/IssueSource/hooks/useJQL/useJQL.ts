import { useState, useEffect } from 'react';
import { value } from '../../../../../../can';
import routeData from '../../../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../../../hooks/useCanObservable';

export const useJQL = () => {
  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, 'jql'));
  const childJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'childJQL'));
  const statusesToExcludeFromRouteData = useCanObservable(value.from<string[]>(routeData, 'statusesToExclude'));
  const loadChildrenFromRouteData = useCanObservable(value.from<boolean>(routeData, 'loadChildren'));

  const [statusesToExclude, setStatusesToExclude] = useState<string[]>(statusesToExcludeFromRouteData);
  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJql, setChildJql] = useState(childJqlFromRouteData);
  const [loadChildren, setLoadChildren] = useState(loadChildrenFromRouteData);

  // Keep the textarea in sync when the JQL is updated externally (e.g. by the
  // cycle time slider expanding the date window and writing to routeData.jql).
  useEffect(() => {
    setJql(jqlFromRouteData);
  }, [jqlFromRouteData]);

  const applyJql = () => {
    routeData.assign({
      jql,
      childJQL: childJql,
      statusesToExclude,
      loadChildren,
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
      (!!jql && (jql !== jqlFromRouteData || childJql !== childJqlFromRouteData || statusesDiffer)) ||
      loadChildren !== loadChildrenFromRouteData,
  };
};
