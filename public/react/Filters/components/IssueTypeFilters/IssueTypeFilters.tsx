import type { FC } from "react";

import React from "react";

import FilterGrid from "../../shared/components/FilterGrid";
import Select from "@atlaskit/select";
import Toggle from "@atlaskit/toggle";

interface IssueTypeFiltersProps {
  isRelease: boolean;
  releases: { label: string; value: string }[];
  setSelectedReleases: (releases: Readonly<{ value: string }[]> | { value: string }[]) => void;
  hideUnknownInitiatives: boolean;
  setHideUnknownInitiatives: (hideUnknownInitiatives: boolean) => void;
  selectedIssueType: string;
  showOnlySemverReleases: boolean;
  setShowOnlySemverReleases: (showOnlySemverReleases: boolean) => void;
}

const IssueTypeFilters: FC<IssueTypeFiltersProps> = ({
  isRelease,
  selectedIssueType,
  releases,
  setSelectedReleases,
  hideUnknownInitiatives,
  setHideUnknownInitiatives,
  showOnlySemverReleases,
  setShowOnlySemverReleases,
}) => {
  return (
    <FilterGrid>
      {isRelease && (
        <>
          <p className="uppercase text-sm font-semibold text-zinc-800 self-center">Releases</p>
          <Select
            className="flex-1"
            isMulti
            isSearchable
            options={releases}
            onChange={setSelectedReleases}
          />
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
            Hide {isRelease ? "Releases" : selectedIssueType + "s"} without dates
          </label>
        </div>
        {isRelease && (
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
    </FilterGrid>
  );
};

export default IssueTypeFilters;
