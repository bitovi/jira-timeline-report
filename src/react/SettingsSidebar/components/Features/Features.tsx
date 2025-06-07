import type { FC } from 'react';

import React from 'react';
import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';

import FeatureToggle from './components/FeatureToggle';
import { useFeatures, useUpdateFeatures } from '../../../services/features';
import { FeatureFlags } from '../../../../jira/features';

import { featureMap, features as FEATURES } from '../../../../configuration/features';

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
    </div>
  );
};

export default FeaturesView;
