import type { FC } from "react";

import React from "react";
import { Flex } from "@atlaskit/primitives";
import Heading from "@atlaskit/heading";
import { LinkButton } from "@atlaskit/button/new";

const StorageNeedsConfigured: FC = () => {
  return (
    <div className="px-4">
      <Flex direction="column" gap="space.100" justifyContent="center" alignItems="center">
        <Heading size="medium">Team storage has not been configured</Heading>
        <LinkButton
          appearance="primary"
          href="https://github.com/bitovi/jira-auto-scheduler/blob/main/docs/saved-configuration.md"
        >
          Configure now
        </LinkButton>
      </Flex>
    </div>
  );
};

export default StorageNeedsConfigured;
