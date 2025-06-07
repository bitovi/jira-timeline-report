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

export const getFeatures = (storage: AppStorage): Promise<FeatureFlags> => {
  return storage.get<FeatureFlags>(featuresKey, []).then((saved) => {
    return { ...defaultFeatures, ...saved };
  });
};

export const updateFeatures = (storage: AppStorage, updates: FeatureFlags): Promise<void> => {
  return storage.update(featuresKey, updates);
};
