import type { FC, MutableRefObject } from 'react';
import type { NormalizeIssueConfig } from '../../../../jira/normalized/normalize';

import { useEffect } from 'react';

import { applyCapacityOverrides, useCapacityOverrides } from '../../../services/capacity-overrides';

// Long enough that clicking the track stepper three times is one simulation, short enough that a
// single edit still feels immediate.
export const CAPACITY_OVERRIDE_DEBOUNCE_MS = 300;

export interface CapacityOverrideApplierProps {
  /** The team configuration as last saved, before any what-if override is layered on. */
  baseRef: MutableRefObject<Partial<NormalizeIssueConfig> | null>;
  /** Bumped whenever the shell replaces `baseRef`, so a live override is re-wrapped onto the new base. */
  baseVersion: number;
  readNormalizeOptions: () => Partial<NormalizeIssueConfig> | null | undefined;
  writeNormalizeOptions: (config: Partial<NormalizeIssueConfig>) => void;
}

/**
 * Re-derives the whole pipeline when a what-if capacity override changes. Overrides deliberately do
 * not travel through the URL: `AutoScheduler` keeps the previous `primaryIssuesOrReleases` array
 * whenever the issue objects are identical, so a URL-only change would be swallowed. Going through
 * `normalizeOptions` produces genuinely new issue objects, which is what restarts the simulation.
 *
 * The read/write of `normalizeOptions` are injected so every `routeData` write stays in the shell.
 */
export const CapacityOverrideApplier: FC<CapacityOverrideApplierProps> = ({
  baseRef,
  baseVersion,
  readNormalizeOptions,
  writeNormalizeOptions,
}) => {
  const { overrides } = useCapacityOverrides();

  useEffect(() => {
    // Nothing to apply and nothing captured yet: seeding here would pin whichever configuration the
    // route-data promise chain happened to have resolved first.
    if (Object.keys(overrides).length === 0 && !baseRef.current) return;

    // Each assignment re-runs normalize → derive → rollup and restarts the Monte Carlo, so coalesce
    // a burst of stepper clicks into one run.
    const timer = setTimeout(() => {
      // Seed from whatever the route-data promise chain resolved, the first time an override lands.
      const base = baseRef.current ?? readNormalizeOptions();
      if (!base) return;
      baseRef.current = base;

      writeNormalizeOptions(applyCapacityOverrides(base, overrides));
    }, CAPACITY_OVERRIDE_DEBOUNCE_MS);

    return () => clearTimeout(timer);
  }, [overrides, baseRef, baseVersion, readNormalizeOptions, writeNormalizeOptions]);

  return null;
};
