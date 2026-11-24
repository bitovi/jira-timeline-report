import { useState, useEffect } from 'react';
import { value } from '../../../../../../can';
import routeData from '../../../../../../canjs/routing/route-data';
import { useCanObservable } from '../../../../../hooks/useCanObservable';

export const useJQL = () => {
  const jqlFromRouteData = useCanObservable(value.from<string>(routeData, 'jql'));
  const childJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'childJQL'));
  const loadChildrenFromRouteData = useCanObservable(value.from<boolean>(routeData, 'loadChildren'));
  const blockerJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'blockerJQL'));
  const loadBlockersFromRouteData = useCanObservable(value.from<boolean>(routeData, 'loadBlockers'));
  // spec/046: "Include the team's other overlapping work" and its optional filter
  const loadOtherWorkFromRouteData = useCanObservable(value.from<boolean>(routeData, 'workTeamTimeOtherWork'));
  const otherWorkJqlFromRouteData = useCanObservable(value.from<string>(routeData, 'workTeamTimeOtherWorkJql'));

  const [jql, setJql] = useState(jqlFromRouteData);
  const [childJql, setChildJql] = useState(childJqlFromRouteData);
  const [loadChildren, setLoadChildren] = useState(loadChildrenFromRouteData);
  const [blockerJql, setBlockerJql] = useState(blockerJqlFromRouteData);
  const [loadBlockers, setLoadBlockers] = useState(loadBlockersFromRouteData);
  const [loadOtherWork, setLoadOtherWork] = useState(loadOtherWorkFromRouteData);
  const [otherWorkJql, setOtherWorkJql] = useState(otherWorkJqlFromRouteData);

  // Keep the textarea in sync when the JQL is updated externally (e.g. by the
  // cycle time slider expanding the date window and writing to routeData.jql).
  useEffect(() => {
    setJql(jqlFromRouteData);
  }, [jqlFromRouteData]);

  const applyJql = () => {
    routeData.assign({
      jql,
      childJQL: childJql,
      loadChildren,
      blockerJQL: blockerJql,
      loadBlockers,
      workTeamTimeOtherWork: loadOtherWork,
      workTeamTimeOtherWorkJql: otherWorkJql,
    });
  };

  return {
    loadChildren,
    jql,
    setJql,
    childJql,
    setChildJql,
    applyJql,
    setLoadChildren,
    blockerJql,
    setBlockerJql,
    loadBlockers,
    setLoadBlockers,
    loadOtherWork,
    setLoadOtherWork,
    otherWorkJql,
    setOtherWorkJql,
    applyButtonEnabled:
      (!!jql &&
        (jql !== jqlFromRouteData ||
          childJql !== childJqlFromRouteData ||
          blockerJql !== blockerJqlFromRouteData ||
          otherWorkJql !== otherWorkJqlFromRouteData)) ||
      loadChildren !== loadChildrenFromRouteData ||
      loadBlockers !== loadBlockersFromRouteData ||
      loadOtherWork !== loadOtherWorkFromRouteData,
  };
};
