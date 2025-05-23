import type { FC } from 'react';

import React from 'react';

import SettingsSection from '../../shared/components/SettingsSection';
import SortBy from '../../shared/components/SortBy';
import Hr from '../../../components/Hr';
import RoundDatesTo from '../../shared/components/RoundDatesTo';
import SecondaryReportType from '../../shared/components/SecondaryReportType';
import StatusesShownAsPlanning from '../../shared/components/StatusesShownAsPlanning';
import { useFeatures } from '../../../services/features';

const ScatterPlotViewSettings: FC = () => {
  const { secondaryReport } = useFeatures();

  return (
    <div>
      <SettingsSection title="sort by" centered>
        <SortBy />
      </SettingsSection>
      <Hr />
      <SettingsSection title="round dates to" centered>
        <RoundDatesTo />
      </SettingsSection>
      {secondaryReport && (
        <>
          <Hr />
          <SettingsSection title="secondary report type" centered>
            <SecondaryReportType />
          </SettingsSection>
          <SettingsSection title="statuses shown as planning" centered>
            <StatusesShownAsPlanning />
          </SettingsSection>
        </>
      )}
    </div>
  );
};

export default ScatterPlotViewSettings;
