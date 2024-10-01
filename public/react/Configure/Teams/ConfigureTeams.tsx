import type { FC } from "react";

import type { NormalizedIssue, NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import type { UseSaveDefaultConfiguration } from "./useSaveDefaultConfiguration";
import type { UseDefaultConfiguration } from "./useDefaultConfiguration";

import React from "react";
import { useForm } from "react-hook-form";
import Form, { FormHeader } from "@atlaskit/form";
import { useQueryClient } from "@tanstack/react-query";

import TextField from "./Textfield";
import { SprintDefaults } from "./plugin";

export interface ConfigureTeamsProps {
  appKey: string;
  useSave: UseSaveDefaultConfiguration;
  useDefaults: UseDefaultConfiguration;
  normalizedIssues?: Array<NormalizedIssue>;
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
}

export type DefaultFormFields = SprintDefaults;

export interface FieldUpdates<TProperty extends keyof DefaultFormFields> {
  name: TProperty;
  value: DefaultFormFields[TProperty];
}

export const createNormalizeConfiguration = (values: DefaultFormFields): Partial<NormalizeIssueConfig> => {
  return {
    getDaysPerSprint: () => Number(values.sprintLength),
  };
};

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ appKey, onUpdate, onInitialDefaultsLoad, useSave, useDefaults }) => {
  const queryClient = useQueryClient();
  const defaults = useDefaults({ appKey, onInitialDefaultsLoad });
  const save = useSave({ appKey });

  const { register, handleSubmit, getValues } = useForm<DefaultFormFields>({ defaultValues: defaults });

  function update<TProperty extends keyof DefaultFormFields>({ name, value }: FieldUpdates<TProperty>) {
    const values = getValues();

    save(
      { ...values, [name]: value },
      {
        onSuccess: () => {
          onUpdate?.(createNormalizeConfiguration(values));

          queryClient.invalidateQueries({ queryKey: ["configuration", "default"] });
        },
      }
    );
  }

  return (
    <Form
      onSubmit={() =>
        handleSubmit((values) => {
          save(values, {
            onSuccess: () => {
              queryClient.invalidateQueries({ queryKey: ["configuration", "default"] });
            },
          });
        })
      }
    >
      {() => (
        <form>
          <FormHeader title="Team Configuration" />
          <TextField name="sprintLength" type="number" label="Sprint length" register={register} onSave={update} />
        </form>
      )}
    </Form>
  );
};

export default ConfigureTeams;
