import routeData from '../../../../../../canjs/routing/route-data';
import { useRouteData } from '../../../../../hooks/useRouteData';
import {
  DEFAULT_WORK_SETTINGS,
  RawWorkSettings,
  WorkSettings,
  WORK_PARAMS,
  WORK_TEAM_TIME_OTHER_WORK_KEY,
} from '../../../../../../jira/rollup/work-size/work-settings';
import type { OtherWorkStatus } from '../../../../../../jira/rollup/work-size/other-work';

/** Settings property → route-data property. */
const ROUTE_KEYS: Record<keyof RawWorkSettings, string> = {
  sizeBy: WORK_PARAMS.sizeBy.key,
  sizeFallback: WORK_PARAMS.sizeFallback.key,
  noEstimate: WORK_PARAMS.noEstimate.key,
  missingSize: WORK_PARAMS.missingSize.key,
  teamTimeOtherWork: WORK_TEAM_TIME_OTHER_WORK_KEY,
};

export const useWorkSettings = () => {
  const [settings] = useRouteData<WorkSettings | undefined>('workSettings');
  const [otherWork] = useRouteData<OtherWorkStatus | undefined>('teamTimeOtherWork');

  /** Writes each given setting to its route param (route data leaves defaults out of the URL). */
  const update = (patch: RawWorkSettings) => {
    for (const [name, value] of Object.entries(patch)) {
      const routeKey = ROUTE_KEYS[name as keyof RawWorkSettings];
      if (routeKey) {
        // @ts-expect-error route data is untyped
        routeData[routeKey] = value;
      }
    }
  };

  return { settings: settings ?? DEFAULT_WORK_SETTINGS, update, otherWork };
};
