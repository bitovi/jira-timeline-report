import React, { Suspense, useState } from "react";
import type { FC } from "react";

import type { NormalizedIssue } from "../../../jira/normalized/normalize";

import Form, { ErrorMessage, Field, FormHeader, HelperMessage } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";
import { QueryClient, QueryClientProvider, useMutation, useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { getSprintDefaults, setSprintDefaults } from "../../../jira/storage/plugin";
import { useForm } from "react-hook-form";

// import "atlaskit/css-reset";

interface ConfigureTeamsProps {
  normalizedIssues?: Array<NormalizedIssue>;
  appKey: string;
}

interface DefaultFormFields {
  sprintLength: number;
}

const ConfigureTeams: FC<ConfigureTeamsProps> = ({ appKey }) => {
  const queryClient = useQueryClient();

  const { data } = useSuspenseQuery({
    queryKey: ["configuration", "default"],
    queryFn: () => getSprintDefaults({ appKey }),
  });

  const { register, handleSubmit } = useForm<DefaultFormFields>({ defaultValues: data });

  const { mutate } = useMutation<void, Error, DefaultFormFields>({
    mutationFn: (values) => {
      return setSprintDefaults(values, { appKey });
    },
  });

  return (
    <form
      onSubmit={handleSubmit((values) => {
        mutate(values, {
          onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["configuration", "default"] });
          },
        });
      })}
    >
      <Field name="sprintLength" label="Sprint length" isRequired>
        {({ fieldProps }) => (
          <TextField type="number" autoComplete="off" {...fieldProps} {...register("sprintLength")} />
        )}
      </Field>
      <button type="submit">Save</button>
    </form>
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
