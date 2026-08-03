import { AppStorage } from '../storage/common';
import { features } from '../../configuration/features';

export const defaultFeatures = features
  .filter((feature) => !feature.onByDefault)
  .reduce<Record<string, boolean>>((acc, feature) => {
    acc[feature.featureFlag] = false;
    return acc;
  }, {});

export type FeatureFlags = typeof defaultFeatures;

const featuresKey = 'features';

/**
 * Retired flags, mapped onto the flag that replaced them — read-time only, so nothing is rewritten
 * in storage until the user next changes a feature.
 *
 * Without this, opting in is silently undone: `Features.tsx`'s `removePreviousFeatures` drops any
 * saved key that isn't in the current `featureMap`, so the first feature change after the rename
 * writes the blob back with the old key gone and the new one never set.
 *
 * The alias loses to an explicit value for the new flag — someone who has already made a choice
 * about `cardsReport` has said what they want. See spec/018-card-report/alt-plan.md (D6).
 */
const RETIRED_FEATURE_ALIASES: Record<string, string> = {
  // spec/018-card-report: the secondary slot was deleted and its report became the Cards report.
  secondaryReport: 'cardsReport',
};

const applyRetiredAliases = (saved: FeatureFlags): FeatureFlags => {
  const aliased: FeatureFlags = {};

  for (const [retired, replacement] of Object.entries(RETIRED_FEATURE_ALIASES)) {
    if (saved[retired] !== undefined && saved[replacement] === undefined) {
      aliased[replacement] = saved[retired];
    }
  }

  return aliased;
};

export const getFeatures = (storage: AppStorage): Promise<FeatureFlags> => {
  return storage.get<FeatureFlags>(featuresKey, []).then((saved) => {
    return { ...defaultFeatures, ...saved, ...applyRetiredAliases(saved ?? {}) };
  });
};

export const updateFeatures = (storage: AppStorage, updates: FeatureFlags): Promise<void> => {
  return storage.update(featuresKey, updates);
};
