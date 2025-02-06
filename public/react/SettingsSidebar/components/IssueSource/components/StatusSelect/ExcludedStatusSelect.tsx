import React, { FC, useId } from "react";
import Select from "@atlaskit/select";
import { Label } from "@atlaskit/form";
import useExcludedStatusSelect from "./hooks/useExcludedStatusSelect";
import type { MultiValue } from "react-select";

export interface ExcludedStatusSelectOption {
  label: string;
  value: string;
}

export interface ExcludedStatusSelectProps {
  label: string;
  placeholder: string;
  value: MultiValue<ExcludedStatusSelectOption>;
  onChange?: (value: MultiValue<ExcludedStatusSelectOption>) => void;
}
const ExcludedStatusSelect: FC<ExcludedStatusSelectProps> = ({
  label,
  placeholder,
  value,
  onChange,
}) => {
  const id = useId();

  const { allStatusesOptions } = useExcludedStatusSelect();

  if (allStatusesOptions.length === 0) {
    return null;
  }
  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={allStatusesOptions}
        value={value}
        isMulti
        isSearchable
        placeholder={placeholder}
        onChange={onChange}
      />
    </>
  );
};

export default ExcludedStatusSelect;
