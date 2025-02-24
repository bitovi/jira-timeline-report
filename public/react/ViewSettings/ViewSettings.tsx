import type { FC } from "react";

import React from "react";
import DropdownMenu from "@atlaskit/dropdown-menu";

import GanttViewSettings from "./components/GanttViewSettings";

const viewSettingsMap = {
  gantt: GanttViewSettings,
};

// TODO: make dynamic once other views are required
const currentView: keyof typeof viewSettingsMap = "gantt";

const ViewSettings: FC = () => {
  const Settings = viewSettingsMap[currentView];

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="view-settings-nested-modal-visibility-override">
      <DropdownMenu shouldRenderToParent trigger="View settings">
        <div className="p-6 w-[475px]">
          <Settings />
        </div>
      </DropdownMenu>
    </div>
  );
};

export default ViewSettings;
