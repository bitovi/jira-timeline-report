import type { FC } from "react";
import type { ConfigureTeamsFormProps } from "./ConfigureTeamsForm";

import React from "react";
import Heading from "@atlaskit/heading";

import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";
import { StorageNeedsConfigured } from "../../services/storage";
import { useGlobalTeamConfiguration } from "./services/team-configuration";
import ConfigureTeamsForm from "./ConfigureTeamsForm";

interface ConfigureTeamsProps extends Omit<ConfigureTeamsFormProps, "userData"> {}

const ConfigureTeams: FC<ConfigureTeamsProps> = (props) => {
  const userData = useGlobalTeamConfiguration();

  if (!userData) {
    return <StorageNeedsConfigured />;
  }

  return (
    <Accordion>
      <AccordionTitle>
        <Heading size="small">Global default</Heading>
      </AccordionTitle>
      <AccordionContent>
        <ConfigureTeamsForm userData={userData} {...props} />
      </AccordionContent>
    </Accordion>
  );
};

export default ConfigureTeams;
