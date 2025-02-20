import type { FC, ReactNode } from "react";

import React, { useRef, useState } from "react";
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

const formatStatuses = (statuses: { status: string; team: { name: string } }[]) => {
  const statusCount: Record<string, number> = {};

  for (const { status } of statuses) {
    if (!statusCount[status]) {
      statusCount[status] = 0;
    }

    statusCount[status]++;
  }

  return [...new Set(statuses.map(({ status }) => status))].map((status) => ({
    label: `${status} (${statusCount[status]})`,
    value: status,
  }));
};

const useStatuses = () => {
  const statuses = useCanObservable<{ status: string; team: { name: string } }[] | undefined>(
    value.from(routeData, "derivedIssues")
  );

  return formatStatuses(statuses || []);
};

const useSelectedStatuses = () => {
  const statusesToShow = useCanObservable<string>(value.from(routeData, "statusesToShow"));
  const statusesToRemove = useCanObservable<string>(value.from(routeData, "statusesToRemove"));

  return { statusesToShow, statusesToRemove };
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

  console.log({ members });
  if (!members.length) {
    return undefined;
  }

  return members.map((member) => ({
    label: allStatuses.find(({ value }) => value === member)?.label,
    value: member,
  }));
};

const Filters: FC = () => {
  const { primaryIssueType, secondaryIssueType } = useSelectedIssueType();
  const selectedIssueType = primaryIssueType === "Release" ? secondaryIssueType : primaryIssueType;
  const shouldShowReleaseFilters = primaryIssueType === "Release";

  const [statusFilterType, setStatusFilterType] = useState<"show" | "hide">("show");

  const statuses = useStatuses();
  const { statusesToShow, statusesToRemove } = useSelectedStatuses();
  const selectedStatuses = statusFilterType === "show" ? statusesToShow : statusesToRemove;

  console.log({
    statusesToShow,
    statusesToRemove,
    selectedStatuses,
    convert: convertToSelectValue(statuses, selectedStatuses),
    statuses,
  });

  const handleStatusFilterChange = (newStatus: "show" | "hide") => {
    setStatusFilterType(newStatus);
  };

  const releases: { label: string; value: string }[] = [];

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
              value={convertToSelectValue(statuses, selectedStatuses)}
              onChange={(value) => {
                const url = new URL(window.location.toString());

                url.searchParams.set("statusesToShow", value.map(({ value }) => value).join(","));
                pushStateObservable.set(url.search);
              }}
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
                <Toggle onChange={() => {}} />
                <label className="text-sm">Hide {selectedIssueType} without dates</label>
              </div>
              {shouldShowReleaseFilters && (
                <div className="flex items-center gap-2">
                  <Toggle onChange={() => {}} />
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
