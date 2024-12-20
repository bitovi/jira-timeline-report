import { MouseEvent, PropsWithChildren, default as React } from "react";

import routeDataObservable from "@routing-observable";
import { deparam, param } from "../../../can";

interface RoutingLinkPropsBase extends PropsWithChildren {
  as?: "a" | "button";
  replaceAll?: boolean;
  className?: string;
}
type RoutingLinkProps = RoutingLinkPropsBase &
  (
    | { data: Record<string, string | null>; href?: string }
    | { href: string; data?: Record<string, string | null> }
  );

export const RoutingLink = ({ as = "a", replaceAll, children, className, ...rest }: RoutingLinkProps) => {
  let href;
  if (rest.href) {
    href = new URL(rest.href, document.baseURI).search;
  } else {
    href = param(rest.data);
  }
  return React.createElement(as, {
    ...(as === "a" ? { href } : {}),
    onClick: (ev: MouseEvent) => {
      ev.preventDefault();

      const patchSet = rest.data ? { ...rest.data } : (deparam(href) as Record<string, string>);
      if (replaceAll) {
        Object.keys(routeDataObservable.get()).forEach((key) => {
          if (!patchSet[key]) {
            patchSet[key] = null;
          }
        });
      }
      routeDataObservable.set(patchSet);
    },
    children,
    className,
  });
};
export default RoutingLink;
