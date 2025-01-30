import type { LinkBuilder } from "../../../routing/common";
import type { FC, ReactNode } from "react";

import React, { createContext, useContext } from "react";

type RoutingContext = { linkBuilder: LinkBuilder } | null;

const RoutingContext = createContext<RoutingContext>(null);

export const useRouting = () => {
  const routing = useContext(RoutingContext);

  if (!routing) {
    return {
      linkBuilder(query: string) {
        return query;
      },
    };
  }

  return routing;
};

interface RoutingProviderProps {
  routing: { linkBuilder: LinkBuilder };
  children: ReactNode;
}

export const RoutingProvider: FC<RoutingProviderProps> = ({ routing, children }) => {
  return <RoutingContext.Provider value={routing}>{children}</RoutingContext.Provider>;
};
