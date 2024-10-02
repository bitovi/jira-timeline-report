import type { FC } from "react";

import type { NormalizedIssue, NormalizeIssueConfig } from "../../../jira/normalized/normalize";
import {
  type SprintDefaults,
  type UseSaveDefaultConfiguration,
  type UseDefaultConfiguration,
  useGlobalTeamConfiguration,
  useSaveGlobalTeamConfiguration,
  teamConfigurationKeys,
} from "./services/team-configuration";

import React from "react";
import { useForm } from "react-hook-form";
import Form, { FormHeader } from "@atlaskit/form";
import { useQueryClient } from "@tanstack/react-query";

import TextField from "./components/TextField";
import { createNormalizeConfiguration } from "./shared/normalize";

export interface ConfigureTeamsProps {
  normalizedIssues?: Array<NormalizedIssue>;
  onInitialDefaultsLoad?: (overrides: Partial<NormalizeIssueConfig>) => void;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
}

export type DefaultFormFields = SprintDefaults;

export interface FieldUpdates<TProperty extends keyof DefaultFormFields> {
  name: TProperty;
  value: DefaultFormFields[TProperty];
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ onUpdate, onInitialDefaultsLoad }) => {
  const queryClient = useQueryClient();

  const defaults = useGlobalTeamConfiguration({ onInitialDefaultsLoad });
  const save = useSaveGlobalTeamConfiguration();

  const { register, handleSubmit, getValues } = useForm<DefaultFormFields>({ defaultValues: defaults });

  function update<TProperty extends keyof DefaultFormFields>({ name, value }: FieldUpdates<TProperty>) {
    const values = getValues();

    save(
      { ...values, [name]: value },
      {
        onSuccess: () => {
          onUpdate?.(createNormalizeConfiguration(values));

          queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.globalConfiguration() });
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
              onUpdate?.(createNormalizeConfiguration(values));

              queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.globalConfiguration() });
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
