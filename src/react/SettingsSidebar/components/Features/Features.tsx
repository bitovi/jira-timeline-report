import type { FC } from 'react';

import React, { useState } from 'react';
import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';

import FeatureToggle from './components/FeatureToggle';
import StorageCautionModal from '../StorageCautionModal';
import { useFeatures, useUpdateFeatures } from '../../../services/features';
import { FeatureFlags } from '../../../../jira/features';

import { featureMap, features as FEATURES, REPORTS_STORAGE_FEATURE_FLAG } from '../../../../configuration/features';

const removePreviousFeatures = (features: FeatureFlags) => {
  return Object.entries(features).reduce((filtered, [key, value]) => {
    if (!featureMap[key as keyof FeatureFlags]) {
      return filtered;
    }

    return { ...filtered, [key]: value };
  }, {} as FeatureFlags);
};

const FeaturesView: FC = () => {
  const features = useFeatures();
  // takes care of features being removed. The store is updated once a change is made
  const cleansedFeatures = removePreviousFeatures(features);

  const { update, isUpdating } = useUpdateFeatures();

  /**
   * Held back rather than applied and undone: `update` writes the whole flag set to storage, so
   * flipping it on to ask the question would already have committed the thing being asked about.
   */
  const [isConfirmingReportsStorage, setIsConfirmingReportsStorage] = useState(false);

  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Features {isUpdating && <Spinner size="small" />}</Heading>
      </div>
      <div className="flex flex-col gap-y-8">
        <p className="text-sm">Turn on new features under active development.</p>
        <ul className="flex flex-col gap-y-8">
          {FEATURES.map((feature) => {
            // Separate key prop since you cannot spread a key prop in React
            return (
              <li key={feature.featureFlag}>
                <FeatureToggle
                  title={feature.name}
                  subtitle={feature.subtitle}
                  disabled={isUpdating}
                  checked={cleansedFeatures[feature.featureFlag] ?? feature.onByDefault}
                  onChange={(newValue) => {
                    // Only on the way on. Turning it back off hides the panel and leaves the
                    // storage pointer exactly where it is, so there is nothing to warn about.
                    if (newValue && feature.featureFlag === REPORTS_STORAGE_FEATURE_FLAG) {
                      setIsConfirmingReportsStorage(true);

                      return;
                    }

                    update({ ...cleansedFeatures, [feature.featureFlag]: newValue });
                  }}
                />
              </li>
            );
          })}
        </ul>
        <p className="text-sm">
          Got feedback?{' '}
          <a href="https://github.com/bitovi/jira-timeline-report/issues/new" className="link" target="_blank">
            Let us know on github.
          </a>
        </p>
      </div>

      <StorageCautionModal
        isOpen={isConfirmingReportsStorage}
        title="Turn on Reports Storage?"
        onCancel={() => setIsConfirmingReportsStorage(false)}
        onConfirm={() => {
          setIsConfirmingReportsStorage(false);
          update({ ...cleansedFeatures, [REPORTS_STORAGE_FEATURE_FLAG]: true });
        }}
      >
        This adds a Storage panel to these settings, where you choose where this site&rsquo;s saved reports live.
      </StorageCautionModal>
    </div>
  );
};

export default FeaturesView;
