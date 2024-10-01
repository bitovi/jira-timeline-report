import type { FC } from "react";

import type { NormalizedIssue, NormalizeIssueConfig } from "../../../jira/normalized/normalize";

import React, { Suspense } from "react";
import { useForm, UseFormReturn } from "react-hook-form";
import Form, { Field, FormHeader } from "@atlaskit/form";
import AtlasTextField from "@atlaskit/textfield";
import { QueryClient, QueryClientProvider, useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";

import { getSprintDefaults, setSprintDefaults } from "../../../jira/storage/plugin";

interface ConfigureTeamsProps {
  normalizedIssues?: Array<NormalizedIssue>;
  appKey: string;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
}

interface DefaultFormFields {
  sprintLength: number;
}

interface FieldUpdates<TProperty extends keyof DefaultFormFields> {
  name: TProperty;
  value: DefaultFormFields[TProperty];
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ appKey, onUpdate }) => {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["configuration", "default"],
    queryFn: () => getSprintDefaults({ appKey }),
  });

  const { register, handleSubmit, getValues } = useForm<DefaultFormFields>({ defaultValues: data });

  const { mutate } = useMutation<void, Error, DefaultFormFields>({
    mutationFn: (values) => {
      return setSprintDefaults(values, { appKey });
    },
  });

  function update<TProperty extends keyof DefaultFormFields>({ name, value }: FieldUpdates<TProperty>) {
    const values = getValues();

    mutate(
      { ...values, [name]: value },
      {
        onSuccess: () => {
          onUpdate?.({ getDaysPerSprint: () => values.sprintLength });
          queryClient.invalidateQueries({ queryKey: ["configuration", "default"] });
        },
      }
    );
  }

  return (
    <Form
      onSubmit={() =>
        handleSubmit((values) => {
          mutate(values, {
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

function isFieldUpdate<TProperty extends keyof DefaultFormFields>(event: {
  name: string;
}): event is FieldUpdates<TProperty> {
  return ["sprintLength"].includes(event.name);
}

const TextField: FC<{
  type: string;
  name: keyof DefaultFormFields;
  label: string;
  register: UseFormReturn<DefaultFormFields>["register"];
  onSave: <TProperty extends keyof DefaultFormFields>(config: FieldUpdates<TProperty>) => void;
}> = ({ register, onSave, type, label, name }) => {
  const handleBlur = (eventTarget: { name: string; value: string }) => {
    if (!isFieldUpdate(eventTarget)) {
      return;
    }

    onSave(eventTarget);
  };

  return (
    <Field name="sprintLength" label={label} isRequired>
      {() => (
        <AtlasTextField
          type={type}
          autoComplete="off"
          {...register(name)}
          onBlur={({ target }) => handleBlur(target)}
        />
      )}
    </Field>
  );
};

const queryClient = new QueryClient();

export default function TeamConfigurationWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <Suspense fallback="loading">
        <ConfigureTeams appKey="bitovi.timeline-report.local" />
      </Suspense>
    </QueryClientProvider>
  );
}
