import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { FC } from "react";
import {
  globalTeamConfigurationStorageKey,
  teamConfigurationKeys,
} from "../../components/Teams/services/team-configuration";
import { useStorage } from "./StorageProvider";
import { Flex } from "@atlaskit/primitives";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button/new";

const StorageNeedsConfigured: FC = () => {
  const { createStorageContainer } = useStorage();
  const queryClient = useQueryClient();

  const { mutate: createStorage } = useMutation({
    mutationFn: () => createStorageContainer(globalTeamConfigurationStorageKey, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.storageContainer() });
    },
  });

  return (
    <div className="px-4">
      <Flex direction="column" gap="space.100" justifyContent="center" alignItems="center">
        <Heading size="medium">Team storage has not been configured</Heading>
        <Button appearance="primary" onClick={() => createStorage()}>
          Configure now
        </Button>
      </Flex>
    </div>
  );
};

export default StorageNeedsConfigured;
