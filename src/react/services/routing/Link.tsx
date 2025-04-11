import type { FC, ComponentProps } from "react";

import React, { forwardRef } from "react";
import { useRouting } from "./RoutingProvider";

interface LinkProps extends ComponentProps<"a"> {}

const isIFrame = !!(AP?.history?.getState ?? false);

/**
 * This is a custom link component that is used to link to pages within the jira application.
 * The default behavior of the link component is to use the linkBuilder to build the href, which
 * can link to new tabs or new windows whether inside or outside the iframe.
 *
 * If the link is clicked, meaning we won't be linking to a new tab or window, we override the behavior
 * in the `onClick` prop and tap in to can's routing system just like we would with any other link.
 */

const Link: FC<LinkProps> = forwardRef<HTMLAnchorElement, LinkProps>(
  ({ href, children, onClick, ...rest }, ref) => {
    const { linkBuilder } = useRouting();

    return (
      <a
        ref={ref}
        href={linkBuilder(href || "")}
        onClick={(event) => {
          if (isIFrame) {
            event.preventDefault();
            event.stopPropagation();

            window.history.pushState(null, "", href);

            onClick?.(event);
          } else {
            onClick?.(event);
          }
        }}
        {...rest}
      >
        {children}
      </a>
    );
  }
);

export default Link;
