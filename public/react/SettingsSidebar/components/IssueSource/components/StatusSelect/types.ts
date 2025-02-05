import type { MultiValue } from "react-select";

export interface StatusSelectOption {
  label: string;
  value: string;
}

export interface StatusSelectProps {
  label: string;
  placeholder: string;
  options: StatusSelectOption[];
  value: MultiValue<StatusSelectOption>;
  onChange: (newValue: MultiValue<StatusSelectOption>) => void;
}
