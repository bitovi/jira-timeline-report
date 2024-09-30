import React, { useState } from "react";
import type { FC } from "react";

import type { NormalizedIssue } from "../../../jira/normalized/normalize";

import Form, { ErrorMessage, Field, FormHeader, HelperMessage } from "@atlaskit/form";
import TextField from "@atlaskit/textfield";

// import "atlaskit/css-reset";

interface ConfigureTeamsProps {
  normalizedIssues: Array<NormalizedIssue>;
}

interface DefaultFormFields {
  sprintLength: number;
}

const ConfigureTeams: FC<ConfigureTeamsProps> = () => {
  return (
    <Form<DefaultFormFields> onSubmit={() => {}}>
      {({ formProps, submitting }) => (
        <form>
          <FormHeader title="Team Configuration" />
          <Field aria-required={true} name="sprintLength" label="Sprint length" isRequired defaultValue="10">
            {({ fieldProps, error }) => (
              <>
                <TextField type="number" autoComplete="off" {...fieldProps} />
                {error && <ErrorMessage>This username is already in use, try another one</ErrorMessage>}
              </>
            )}
          </Field>
        </form>
      )}
    </Form>
  );
};

export default ConfigureTeams;
