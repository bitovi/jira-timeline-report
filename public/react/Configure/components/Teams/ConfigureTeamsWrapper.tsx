import type { FC } from "react";
import type { ConfigureTeamsProps } from "./ConfigureTeams";

import React from "react";

import Heading from "@atlaskit/heading";

import ConfigureTeams from "./ConfigureTeams";
import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";

interface TeamConfigurationWrapperProps extends Pick<ConfigureTeamsProps, "onUpdate" | "onInitialDefaultsLoad"> {}

const TeamConfigurationWrapper: FC<TeamConfigurationWrapperProps> = (props) => {
  return (
    <div className="w-96">
      <Accordion>
        <AccordionTitle>
          <Heading size="small">Global default</Heading>
        </AccordionTitle>
        <AccordionContent>
          <ConfigureTeams {...props} />
        </AccordionContent>
      </Accordion>
    </div>
  );
};

export default TeamConfigurationWrapper;
