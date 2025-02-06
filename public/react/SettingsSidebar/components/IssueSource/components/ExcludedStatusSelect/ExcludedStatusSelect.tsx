import React, { FC, useId } from "react";
import Select from "@atlaskit/select";
import { Label } from "@atlaskit/form";
import useExcludedStatusSelect from "./hooks/useExcludedStatusSelect";

export interface ExcludedStatusSelectOption {
  label: string;
  value: string;
}

export interface ExcludedStatusSelectProps {
  label: string;
  placeholder: string;
  value: ExcludedStatusSelectOption[];
  onChange?: (value: Readonly<ExcludedStatusSelectOption[]>) => void;
}
const ExcludedStatusSelect: FC<ExcludedStatusSelectProps> = ({
  label,
  placeholder,
  value,
  onChange,
}) => {
  const id = useId();

  const { allStatusesOptions } = useExcludedStatusSelect();

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <Select
        isDisabled={allStatusesOptions.length === 0}
        id={id}
        options={allStatusesOptions}
        value={value}
        isMulti
        isSearchable
        placeholder={placeholder}
        onChange={onChange}
      />
    </div>
  );
};

export default ExcludedStatusSelect;
