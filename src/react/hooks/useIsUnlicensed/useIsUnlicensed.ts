import { useEffect, useState } from 'react';

import { useRouteData } from '../useRouteData';

interface LicensingInformation {
  active: boolean;
  evaluation: boolean;
}

/**
 * Whether the host reported an inactive license (`licensingPromise`, set by each `*.main.ts`).
 *
 * Only a resolved `active: false` counts. Still loading, no promise (tests, Storybook) or a
 * rejected read all answer `false` — the sad Eggbert is a nudge to subscribe, so it should never
 * show for a site we simply couldn't check.
 */
export const useIsUnlicensed = (): boolean => {
  const [licensingPromise] = useRouteData<Promise<LicensingInformation> | null>('licensingPromise');
  const [unlicensed, setUnlicensed] = useState(false);

  useEffect(() => {
    if (!licensingPromise) return;

    let cancelled = false;

    licensingPromise.then(
      (licensing) => {
        if (!cancelled) setUnlicensed(!licensing.active);
      },
      () => {},
    );

    return () => {
      cancelled = true;
    };
  }, [licensingPromise]);

  return unlicensed;
};
