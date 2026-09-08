import type { LinkBuilder } from '../../../routing/common';
import type { FC, ReactNode } from 'react';

import React, { createContext, useContext } from 'react';

export interface Routing {
  linkBuilder: LinkBuilder;
  /**
   * Whether a {@link Link} click should be intercepted into the SPA router instead of letting the
   * browser navigate.
   *
   * True for the embedded hosts (Connect, Forge), where the built href is a *container* URL that
   * would navigate the whole page out from under the iframe; false for the standalone website,
   * where the href is the app's own URL and the browser can just follow it.
   *
   * This used to be a module-scope constant in `Link.tsx` probing the `AP` global — which baked
   * the answer at import time, made the component behave differently in Storybook than in the app,
   * and answered "no" under Forge, a host where `AP` does not exist but interception is still
   * wanted.
   */
  interceptLinkClicks?: boolean;
}

type RoutingContext = Routing | null;

const RoutingContext = createContext<RoutingContext>(null);

export const useRouting = (): Required<Routing> => {
  const routing = useContext(RoutingContext);

  if (!routing) {
    return {
      linkBuilder(query: string) {
        return query;
      },
      interceptLinkClicks: false,
    };
  }

  return { interceptLinkClicks: false, ...routing };
};

interface RoutingProviderProps {
  routing: Routing;
  children: ReactNode;
}

export const RoutingProvider: FC<RoutingProviderProps> = ({ routing, children }) => {
  return <RoutingContext.Provider value={routing}>{children}</RoutingContext.Provider>;
};
