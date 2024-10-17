import type { FC } from "react";
import type { FieldUpdates } from "../../ConfigureTeamsForm";
import type { Configuration } from "../../services/team-configuration";

import React from "react";

import AtlasTextField from "@atlaskit/textfield";
import { UseFormReturn } from "react-hook-form";
import { Field } from "@atlaskit/form";

interface TextFieldProps {
  disabled?: boolean;
  type: string;
  name: keyof Configuration;
  label: string;
  min?: number;
  unit?: string;
  register: UseFormReturn<Configuration>["register"];
  onSave: <TProperty extends keyof Configuration>(config: FieldUpdates<TProperty>) => void;
}

export function isFieldUpdate(event: { name: string }): event is { name: keyof Configuration } {
  return [
    "sprintLength",
    "velocityPerSprint",
    "tracks",
    "estimateField",
    "confidenceField",
    "startDateField",
    "dueDateField",
    "spreadEffortAcrossDates",
  ].includes(event.name);
}

const TextField: FC<TextFieldProps> = ({ register, onSave, type, label, name, min, unit, disabled = false }) => {
  const handleBlur = (eventTarget: { name: string; value: string }) => {
    if (!isFieldUpdate(eventTarget)) {
      return;
    }

    onSave(eventTarget);
  };

  const props = register(name);

  return (
    <Field name="sprintLength" label={label} isRequired>
      {() => (
        <>
          <AtlasTextField
            // These classes are needed to make the `elemAfterProp` function the same as the
            // `slot` prop in figma
            className="[&>input]:!flex-1 [&>input]:!p-0 !py-2 !px-2 !h-10 no-spin-container"
            isDisabled={disabled}
            type={type}
            min={min}
            autoComplete="off"
            elemAfterInput={unit ? <div>{unit}</div> : null}
            {...props}
            onBlur={(e) => {
              props.onBlur(e);
              handleBlur(e.target);
            }}
          />
        </>
      )}
    </Field>
  );
};

export default TextField;
