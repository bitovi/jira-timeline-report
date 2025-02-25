import type { FC } from "react";

import React from "react";

import SettingsSection from "../../shared/components/SettingsSection";
import ShowCompletionPercentage from "../../shared/components/ShowCompletionPercentage";
import ShowWorkBreakdown from "../../shared/components/ShowWorkBreakdown";
import GroupBy from "../../shared/components/GroupBy";
import SortBy from "../../shared/components/SortBy";
import Hr from "../../../components/Hr";
import RoundDatesTo from "../../shared/components/RoundDatesTo";
import SecondaryReportType from "../../shared/components/SecondaryReportType";
import StatusesShownAsPlanning from "../../shared/components/StatusesShownAsPlanning";
import { useSelectedIssueType } from "../../../services/issues";

const GanttViewSettings: FC = () => {
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
      <SettingsSection title="view options">
        <ShowCompletionPercentage />
        <ShowWorkBreakdown />
      </SettingsSection>
      <SettingsSection title="secondary report type" centered>
        <SecondaryReportType />
      </SettingsSection>
      <SettingsSection title="statuses shown as planning" centered>
        <StatusesShownAsPlanning />
      </SettingsSection>
    </div>
  );
};

export default GanttViewSettings;
