import type { FC } from "react";

import React from "react";
import SettingsSection from "../../shared/components/SettingsSection";
import ShowCompletionPercentage from "../../shared/components/ShowCompletionPercentage/ShowCompletionPercentage";
import ShowWorkBreakdown from "../../shared/components/ShowWorkBreakdown";
import SortBy from "../../shared/components/SortBy";

const GanttViewSettings: FC = () => {
  return (
    <div>
      <SettingsSection title="sort by">
        <SortBy />
      </SettingsSection>
      <SettingsSection title="view options">
        <ShowCompletionPercentage />
        <ShowWorkBreakdown />
      </SettingsSection>
    </div>
  );
};

export default GanttViewSettings;
