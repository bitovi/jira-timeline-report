import { AppStorage } from "../storage/common";

export const defaultFeatures = {
  estimationTable: false,
  secondaryReport: false,
  workBreakdowns: false,
  groupReport: false
};

export type Features = typeof defaultFeatures;

const featuresKey = "features";

export const getFeatures = (storage: AppStorage): Promise<Features> => {
  return storage.get<Features>(featuresKey, []).then((saved) => {
    return { ...defaultFeatures, ...saved };
  });
};

export const updateFeatures = (storage: AppStorage, updates: Features): Promise<void> => {
  return storage.update(featuresKey, updates);
};
