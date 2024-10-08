import type { FC, ReactNode } from "react";
import type { AppStorage } from "../../../../../jira/storage/common";

import React, { createContext, useContext } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button/new";

import { globalTeamConfigurationStorageKey, teamConfigurationKeys } from "../team-configuration";
import { Flex } from "@atlaskit/primitives";

type StorageContextValues = AppStorage | null;

const StorageContext = createContext<StorageContextValues>(null);

export const useStorage = () => {
  const storage = useContext(StorageContext);

  if (!storage) {
    throw new Error("Cannot use useStorage outside of its provider");
  }

  return storage;
};

interface StorageProviderProps {
  storage: AppStorage;
  children: ReactNode;
}

export const StorageProvider: FC<StorageProviderProps> = ({ storage, children }) => {
  const queryClient = useQueryClient();

  const { data: storageAvailable } = useSuspenseQuery({
    queryKey: teamConfigurationKeys.storageContainer(),
    queryFn: () => storage.storageContainerExists(globalTeamConfigurationStorageKey),
  });

  const { mutate: createStorage } = useMutation({
    mutationFn: () => storage.createStorageContainer(globalTeamConfigurationStorageKey, {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: teamConfigurationKeys.storageContainer() });
    },
  });

  if (!storageAvailable) {
    return (
      <Flex direction="column" gap="space.100" justifyContent="center" alignItems="center">
        <Heading size="medium">Team storage has not been configured</Heading>
        <Button appearance="primary" onClick={() => createStorage()}>
          Configure now
        </Button>
      </Flex>
    );
  }

  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};
