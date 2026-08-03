import type { AppStorage } from '../storage/common';

import { defaultFeatures, getFeatures } from './fetcher';

const storageHolding = (saved: unknown): AppStorage =>
  ({
    get: async () => saved,
    update: async () => {},
    storageInitialized: async () => true,
  }) as unknown as AppStorage;

describe('getFeatures', () => {
  it('fills in the defaults for a flag nothing has been saved for', async () => {
    const features = await getFeatures(storageHolding(null));

    expect(features).toEqual(defaultFeatures);
    expect(features.cardsReport).toBe(false);
  });

  it('lets a saved value win over the default', async () => {
    expect((await getFeatures(storageHolding({ cardsReport: true }))).cardsReport).toBe(true);
  });

  /**
   * The retired-flag alias. Without it, opting in is silently undone: `Features.tsx` drops any saved
   * key that isn't in the current `featureMap`, so the first feature change after a rename writes the
   * blob back with the old key gone and the new one never set — and everyone who had the feature on
   * quietly loses it. See spec/018-card-report/alt-plan.md (D6).
   */
  describe('a retired flag', () => {
    it('carries secondaryReport onto cardsReport', async () => {
      expect((await getFeatures(storageHolding({ secondaryReport: true }))).cardsReport).toBe(true);
    });

    it('carries an explicit opt-out too, rather than only the opt-in', async () => {
      const features = await getFeatures(storageHolding({ secondaryReport: false, cardsReport: undefined }));

      expect(features.cardsReport).toBe(false);
    });

    // Someone who has already made a choice about the new flag has said what they want.
    it('loses to an explicit value for the flag that replaced it', async () => {
      const features = await getFeatures(storageHolding({ secondaryReport: true, cardsReport: false }));

      expect(features.cardsReport).toBe(false);
    });

    it('leaves every other flag alone', async () => {
      const features = await getFeatures(storageHolding({ secondaryReport: true, tableReport: true }));

      expect(features.tableReport).toBe(true);
      expect(features.workBreakdowns).toBe(false);
    });
  });
});
