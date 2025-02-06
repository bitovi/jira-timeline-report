import React, { FC, useId } from "react";
import Select from "@atlaskit/select";
import { Label } from "@atlaskit/form";
import { ExcludedStatusSelectProps } from "./types";
import useExcludedStatusSelect from "./hooks/useExcludedStatusSelect";

const ExcludedStatusSelect: FC<ExcludedStatusSelectProps> = ({ label, placeholder, onChange }) => {
  const id = useId();

  const { allStatusesOptions } = useExcludedStatusSelect();

  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={allStatusesOptions}
        isMulti
        isSearchable
        placeholder={placeholder}
        onChange={onChange}
      />
    </>
  );
};

export default ExcludedStatusSelect;
