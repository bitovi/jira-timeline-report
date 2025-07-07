import React from 'react';
import Select from '@atlaskit/select';
import { Label } from '@atlaskit/form';
import { useJiraIssueFields } from '../../../services/jira';

interface FieldOption {
  label: string;
  value: string;
}

interface SelectAdditionalFieldsProps {
  /** Currently selected field values */
  selectedFields: FieldOption[];
  /** Callback when selection changes */
  onFieldsChange: (selectedFields: FieldOption[]) => void;
  /** Optional label for the component */
  label?: string;
  /** Optional placeholder text */
  placeholder?: string;
  /** Whether the component is disabled */
  disabled?: boolean;
}

export const SelectAdditionalFields: React.FC<SelectAdditionalFieldsProps> = ({
  selectedFields,
  onFieldsChange,
  label = 'Additional Fields',
  placeholder = 'Select additional fields...',
  disabled = false,
}) => {
  const jiraFields = useJiraIssueFields();

  // Transform Jira fields to options format
  const availableFields = jiraFields.map(({ name }) => ({
    value: name,
    label: name,
  }));

  return (
    <div className="flex flex-col">
      <Label htmlFor="additional-fields-select">{label}</Label>
      <Select
        id="additional-fields-select"
        isMulti
        isSearchable
        options={availableFields}
        value={selectedFields}
        onChange={(newSelection) => {
          // Handle the case where newSelection might be null
          const fields = newSelection || [];
          onFieldsChange(fields as FieldOption[]);
        }}
        placeholder={placeholder}
        isDisabled={disabled}
        className="mt-1"
      />
    </div>
  );
};

export default SelectAdditionalFields;
