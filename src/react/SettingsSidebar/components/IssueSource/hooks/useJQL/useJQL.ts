import { useState, useEffect } from 'react';
import { value } from '../../../../../../can';
import routeData from '../../../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../../../hooks/useCanObservable';

export const useJQL = () => {
  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, 'jql'));
  const childJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'childJQL'));
  const statusesToExcludeFromRouteData = useCanObservable(value.from<string[]>(routeData, 'statusesToExclude'));
  const loadChildrenFromRouteData = useCanObservable(value.from<boolean>(routeData, 'loadChildren'));
  const blockerJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'blockerJQL'));
  const loadBlockersFromRouteData = useCanObservable(value.from<boolean>(routeData, 'loadBlockers'));

  const [statusesToExclude, setStatusesToExclude] = useState<string[]>(statusesToExcludeFromRouteData);
  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJql, setChildJql] = useState(childJqlFromRouteData);
  const [loadChildren, setLoadChildren] = useState(loadChildrenFromRouteData);
  const [blockerJql, setBlockerJql] = useState(blockerJqlFromRouteData);
  const [loadBlockers, setLoadBlockers] = useState(loadBlockersFromRouteData);

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
      blockerJQL: blockerJql,
      loadBlockers,
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
    blockerJql,
    setBlockerJql,
    loadBlockers,
    setLoadBlockers,
    applyButtonEnabled:
      (!!jql &&
        (jql !== jqlFromRouteData ||
          childJql !== childJqlFromRouteData ||
          blockerJql !== blockerJqlFromRouteData ||
          statusesDiffer)) ||
      loadChildren !== loadChildrenFromRouteData ||
      loadBlockers !== loadBlockersFromRouteData,
  };
};
