import type { FC } from "react";

import React, { Suspense } from "react";
import DropdownMenu from "@atlaskit/dropdown-menu";

import GanttViewSettings from "./components/GanttViewSettings";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../services/query";
import { StorageProvider } from "../services/storage";
import routeData from "../../canjs/routing/route-data";

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
      <Suspense>
        <QueryClientProvider client={queryClient}>
          <StorageProvider storage={routeData.storage}>
            <DropdownMenu shouldRenderToParent trigger="View settings">
              <div className="p-6 w-[475px]">
                <Settings />
              </div>
            </DropdownMenu>
          </StorageProvider>
        </QueryClientProvider>
      </Suspense>
    </div>
  );
};

export default ViewSettings;
