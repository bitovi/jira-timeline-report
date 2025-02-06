import type { MultiValue } from "react-select";

export interface ExcludedStatusSelectOption {
  label: string;
  value: string;
}

export interface ExcludedStatusSelectProps {
  label: string;
  placeholder: string;
  onChange?: (value: MultiValue<ExcludedStatusSelectOption>) => void;
}
