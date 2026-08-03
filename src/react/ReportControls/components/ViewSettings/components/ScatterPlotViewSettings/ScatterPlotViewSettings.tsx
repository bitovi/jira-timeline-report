import type { FC } from 'react';

import React from 'react';

import SettingsSection from '../../shared/components/SettingsSection';
import SortBy from '../../shared/components/SortBy';
import GroupBy from '../../shared/components/GroupBy';
import Hr from '../../../../../components/Hr';
import RoundDatesTo from '../../shared/components/RoundDatesTo';
import StatusesShownAsPlanning from '../../shared/components/StatusesShownAsPlanning';
import { useSelectedIssueType } from '../../../../../services/issues';

const ScatterPlotViewSettings: FC = () => {
  const { isRelease } = useSelectedIssueType();

  const canGroup = !isRelease;

  return (
    <div>
      <SettingsSection title="sort by" centered>
        <SortBy />
      </SettingsSection>
      {canGroup && (
        <SettingsSection title="group by" centered>
          <GroupBy />
        </SettingsSection>
      )}
      <Hr />
      <SettingsSection title="round dates to" centered>
        <RoundDatesTo />
      </SettingsSection>
      <Hr />
      {/* Kept after the secondary slot was deleted: `planningStatuses` feeds the view model's
          planning filter for every report, not just the Cards report it also drives. */}
      <SettingsSection title="statuses shown as planning" centered>
        <StatusesShownAsPlanning />
      </SettingsSection>
    </div>
  );
};

export default ScatterPlotViewSettings;
