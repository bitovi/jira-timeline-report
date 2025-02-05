import React, { FC, useId } from "react";
import Select from "@atlaskit/select";
import { Label } from "@atlaskit/form";
import { StatusSelectProps } from "./types";

const StatusSelect: FC<StatusSelectProps> = ({ label, placeholder, options, value, onChange }) => {
  const id = useId();

  return (
    <>
      <Label htmlFor={id}>{label}</Label>
      <Select
        id={id}
        options={options}
        isMulti
        isSearchable
        placeholder={placeholder}
        value={value}
        onChange={onChange}
      />
    </>
  );
};

export default StatusSelect;
