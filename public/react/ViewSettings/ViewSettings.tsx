import type { FC } from "react";

import React, { Suspense } from "react";
import DropdownMenu from "@atlaskit/dropdown-menu";

import GanttViewSettings from "./components/GanttViewSettings";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "../services/query";
import { StorageProvider } from "../services/storage";
import routeData from "../../canjs/routing/route-data";
import { ErrorBoundary } from "@sentry/react";
import { useCanObservable } from "../hooks/useCanObservable";
import { value } from "../../can";
import ScatterPlotViewSettings from "./components/ScatterPlotViewSettings";

const reports = [
  {
    key: "start-due",
    name: "Gantt Chart",
  },
  {
    key: "due",
    name: "Scatter Plot",
  },
  {
    key: "table",
    name: "Estimation Table",
  },
  {
    key: "groupReport",
    name: "Group Report"
  }
] as const;

type ReportTypes = (typeof reports)[number]["key"];

const viewSettingsMap: Record<Exclude<ReportTypes, "table">, FC> = {
  "start-due": GanttViewSettings,
  due: ScatterPlotViewSettings,
  groupReport: () =>{ return <></>}
};

const useReportType = () => {
  return useCanObservable<ReportTypes>(value.from(routeData, "primaryReportType"));
};

const ViewSettings: FC = () => {
  const currentReportType = useReportType();

  if (currentReportType === "table") {
    return null;
  }

  const Settings = viewSettingsMap[currentReportType];

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="view-settings-nested-modal-visibility-override">
      <ErrorBoundary fallback={() => <p>Something went wrong</p>}>
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
      </ErrorBoundary>
    </div>
  );
};

export default ViewSettings;
