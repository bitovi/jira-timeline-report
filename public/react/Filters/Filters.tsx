import type { FC, ReactNode } from "react";

import React, { useEffect, useRef, useState } from "react";
import routeData from "../../canjs/routing/route-data";
import DropdownMenu, { DropdownItem, DropdownItemGroup } from "@atlaskit/dropdown-menu";
import { useQueryParams } from "../hooks/useQueryParams";
import { pushStateObservable } from "../../canjs/routing/state-storage";
import ToggleButton from "../components/ToggleButton";
import Select from "@atlaskit/select";
import Hr from "../components/Hr";
import Toggle from "@atlaskit/toggle";
import { useCanObservable } from "../hooks/useCanObservable";
import { value } from "../../can";

const FiltersGrid: FC<{ children: ReactNode }> = ({ children }) => {
  return <div className="grid grid-cols-[200px_1fr] gap-6">{children}</div>;
};

const useSelectedIssueType = () => {
  const primaryIssueType = useCanObservable<string>(value.from(routeData, "primaryIssueType"));
  const secondaryIssueType = useCanObservable<string>(value.from(routeData, "secondaryIssueType"));

  return { primaryIssueType, secondaryIssueType };
};

const getStatusesFromDerivedIssues = (derivedIssues: MinimalDerivedIssue[]) => {
  const statusCount: Record<string, number> = {};

  for (const { status } of derivedIssues) {
    if (!statusCount[status]) {
      statusCount[status] = 0;
    }

    statusCount[status]++;
  }

  return [...new Set(derivedIssues.map(({ status }) => status))].map((status) => ({
    label: `${status} (${statusCount[status]})`,
    value: status,
  }));
};

type MinimalDerivedIssue = {
  status: string;
  team: { name: string };
  releases: Array<{ name: string }>;
};

const useDerivedIssues = () => {
  const derivedIssues = useCanObservable<MinimalDerivedIssue[] | undefined>(
    value.from(routeData, "derivedIssues")
  );

  return derivedIssues;
};

const useStatuses = () => {
  const derivedIssues = useDerivedIssues();

  return getStatusesFromDerivedIssues(derivedIssues || []);
};

const getReleasesFromDerivedIssues = (derivedIssues: MinimalDerivedIssue[]) => {
  const releases = derivedIssues.map(({ releases }) => releases.map(({ name }) => name)).flat(1);

  return releases.map((release) => ({
    label: release,
    value: release,
  }));
};

const useReleases = () => {
  const derivedIssues = useDerivedIssues();

  return getReleasesFromDerivedIssues(derivedIssues || []);
};

const useSelectedReleases = () => {
  const releases = useReleases();

  const setSelectedReleases = (
    newReleases: Readonly<{ value: string }[]> | { value: string }[]
  ) => {
    //@ts-expect-error
    routeData.releasesToShow = newReleases.map(({ value }) => value).join(",");
  };

  return [releases, setSelectedReleases] as const;
};

const useSelectedStatuses = (mode: "show" | "hide") => {
  const statuses = useStatuses();
  const statusesToShow = useCanObservable<string>(value.from(routeData, "statusesToShow"));
  const statusesToRemove = useCanObservable<string>(value.from(routeData, "statusesToRemove"));

  const selectedStatuses = mode === "show" ? statusesToShow : statusesToRemove;
  const setSelectedStatus = (newStatuses: Readonly<{ value: string }[]> | { value: string }[]) => {
    //@ts-expect-error
    routeData[mode === "show" ? "statusesToShow" : "statusesToRemove"] = newStatuses
      .map(({ value }) => value)
      .join(",");
  };

  const swapShowHideStatusesIfNeeded = (newMode: "show" | "hide") => {
    if (newMode === "show") {
      if (statusesToRemove.length) {
        // @ts-expect-error
        routeData.statusesToShow = statusesToRemove;
      }
      // @ts-expect-error
      routeData.statusesToRemove = "";
    } else {
      if (statusesToShow.length) {
        // @ts-expect-error
        routeData.statusesToRemove = statusesToShow;
      }
      // @ts-expect-error
      routeData.statusesToShow = "";
    }
  };

  return {
    statuses,
    selectedStatuses: convertToSelectValue(statuses, selectedStatuses),
    setSelectedStatus,
    swapShowHideStatusesIfNeeded,
  };
};

const convertToSelectValue = (
  allStatuses: {
    label: string;
    value: string;
  }[],
  selectedStatuses: string
) => {
  const decoded = decodeURIComponent(selectedStatuses);
  const members = decoded.split(",").filter(Boolean);

  if (!members.length) {
    return undefined;
  }

  return members.map((member) => ({
    label: allStatuses.find(({ value }) => value === member)?.label,
    value: member,
  }));
};

const useUnknownInitiatives = () => {
  const hideUnknownInitiatives = useCanObservable<boolean>(
    value.from(routeData, "hideUnknownInitiatives")
  );

  const setHideUnknownInitiatives = (newHideUnknownInitiatives: boolean) => {
    // @ts-expect-error
    routeData.hideUnknownInitiatives = newHideUnknownInitiatives;
  };

  return [hideUnknownInitiatives, setHideUnknownInitiatives] as const;
};

const useShowOnlySemverReleases = () => {
  const showOnlySemverReleases = useCanObservable<boolean>(
    value.from(routeData, "showOnlySemverReleases")
  );

  const setShowOnlySemverReleases = (newShowOnlySemverReleases: boolean) => {
    // @ts-expect-error
    routeData.showOnlySemverReleases = newShowOnlySemverReleases;
  };

  return [showOnlySemverReleases, setShowOnlySemverReleases] as const;
};

const Filters: FC = () => {
  const { primaryIssueType, secondaryIssueType } = useSelectedIssueType();
  const selectedIssueType = primaryIssueType === "Release" ? secondaryIssueType : primaryIssueType;
  const shouldShowReleaseFilters = primaryIssueType === "Release";

  const [statusFilterType, setStatusFilterType] = useState<"show" | "hide">("show");
  const { statuses, selectedStatuses, setSelectedStatus, swapShowHideStatusesIfNeeded } =
    useSelectedStatuses(statusFilterType);

  const handleStatusFilterChange = (newStatus: "show" | "hide") => {
    // TODO: move hide to show and show to hide
    setStatusFilterType(newStatus);
    swapShowHideStatusesIfNeeded(newStatus);
  };

  const [hideUnknownInitiatives, setHideUnknownInitiatives] = useUnknownInitiatives();
  const [showOnlySemverReleases, setShowOnlySemverReleases] = useShowOnlySemverReleases();
  const [releases, setSelectedReleases] = useSelectedReleases();

  return (
    // Don't touch this id, its a hack to change the overflow of the dropdown menu
    <div id="filters-nested-modal-visibility-override">
      <DropdownMenu shouldRenderToParent trigger="Filters">
        <div className="p-6 w-[550px]">
          <p className="uppercase text-sm font-semibold text-zinc-800 pb-6">
            {selectedIssueType} statuses
          </p>
          <FiltersGrid>
            <ToggleButton
              active={statusFilterType === "hide"}
              onActiveChange={(newActive) => {
                handleStatusFilterChange(newActive ? "hide" : "show");
              }}
              inactiveLabel="Show only"
              activeLabel="Hide"
            />
            <Select
              isMulti
              isSearchable
              className="flex-1"
              options={statuses}
              value={selectedStatuses}
              onChange={setSelectedStatus}
            />
          </FiltersGrid>
          <Hr className="my-6" />
          <FiltersGrid>
            {shouldShowReleaseFilters && (
              <>
                <p className="uppercase text-sm font-semibold text-zinc-800 self-center">
                  Releases
                </p>
                <Select className="flex-1" options={releases} isMulti isSearchable />
              </>
            )}
            <p className="uppercase text-sm font-semibold text-zinc-800">Filter Options</p>
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Toggle
                  isChecked={hideUnknownInitiatives}
                  onChange={({ target }) => {
                    setHideUnknownInitiatives(target.checked);
                  }}
                />
                <label className="text-sm">
                  Hide {shouldShowReleaseFilters ? "Releases" : selectedIssueType + "s"} without
                  dates
                </label>
              </div>
              {shouldShowReleaseFilters && (
                <div className="flex items-center gap-2">
                  <Toggle
                    isChecked={showOnlySemverReleases}
                    onChange={({ target }) => {
                      setShowOnlySemverReleases(target.checked);
                    }}
                  />
                  <label className="text-sm">Limit to SemVer releases only</label>
                </div>
              )}
            </div>
          </FiltersGrid>
        </div>
      </DropdownMenu>
    </div>
  );
};

export default Filters;
