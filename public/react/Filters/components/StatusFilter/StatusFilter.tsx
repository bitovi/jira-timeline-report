import type { FC } from "react";

import React, { useId } from "react";
import Select from "@atlaskit/select";

import FilterGrid from "../../shared/components/FilterGrid";
import ToggleButton from "../../../components/ToggleButton";
import VisuallyHidden from "@atlaskit/visually-hidden/dist/types/visually-hidden";

interface StatusFilterProps {
  statusFilterType: "hide" | "show";
  setStatusFilterType: (newActive: "hide" | "show") => void;
  statuses: { label: string; value: string }[] | undefined;
  selectedStatuses: { label: string; value: string }[] | undefined;
  setSelectedStatus: (newStatuses: Readonly<{ value: string }[]> | { value: string }[]) => void;
}

const StatusFilter: FC<StatusFilterProps> = ({
  statusFilterType,
  setStatusFilterType,
  statuses,
  selectedStatuses,
  setSelectedStatus,
}) => {
  const id = useId();

  return (
    <FilterGrid>
      <ToggleButton
        active={statusFilterType === "hide"}
        onActiveChange={(newActive) => {
          setStatusFilterType(newActive ? "hide" : "show");
        }}
        inactiveLabel="Show only"
        activeLabel="Hide"
      />
      <VisuallyHidden>
        <label htmlFor={id}>Select statuses to {statusFilterType}</label>
      </VisuallyHidden>
      <Select
        isMulti
        isSearchable
        id={id}
        className="flex-1"
        options={statuses}
        value={selectedStatuses}
        onChange={setSelectedStatus}
      />
    </FilterGrid>
  );
};

export default StatusFilter;
