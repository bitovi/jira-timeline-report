import type { FC, ReactNode } from "react";
import type { AppStorage } from "../../../../jira/storage/common";

import React, { createContext, useContext } from "react";
import { useMutation, useQueryClient, useSuspenseQuery } from "@tanstack/react-query";
import Heading from "@atlaskit/heading";
import Button from "@atlaskit/button/new";

import {
  globalTeamConfigurationStorageKey,
  teamConfigurationKeys,
} from "../../components/Teams/services/team-configuration";
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
  return <StorageContext.Provider value={storage}>{children}</StorageContext.Provider>;
};
