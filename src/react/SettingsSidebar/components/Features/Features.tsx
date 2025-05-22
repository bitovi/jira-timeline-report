import type { FC } from 'react';

import React from 'react';
import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';

import FeatureToggle from './components/FeatureToggle';
import { useFeatures, useUpdateFeatures } from '../../../services/features';
import { Features } from '../../../../jira/features';

const keyToTitle = {
  estimationTable: 'Estimation Table',
  secondaryReport: 'Secondary Report',
  workBreakdowns: 'Work Breakdowns',
};

const keyToSubtitle = {
  estimationTable: '',
  secondaryReport: '',
  workBreakdowns: '',
};

const toList = (features: Features) => {
  return Object.entries(features).map(([key, value]) => ({
    title: keyToTitle[key as keyof Features],
    subtitle: keyToSubtitle[key as keyof Features],
    value,
    key,
  }));
};

const removePreviousFeatures = (features: Features) => {
  return Object.entries(features).reduce((filtered, [key, value]) => {
    if (!keyToTitle[key as keyof Features]) {
      return filtered;
    }

    return { ...filtered, [key]: value };
  }, {} as Features);
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
          {toList(cleansedFeatures).map((feature) => (
            <li key={feature.title}>
              <FeatureToggle
                {...feature}
                disabled={isUpdating}
                checked={feature.value}
                onChange={(newValue) => {
                  update({ ...cleansedFeatures, [feature.key]: newValue });
                }}
              />
            </li>
          ))}
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
