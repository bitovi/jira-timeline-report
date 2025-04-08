import React, { forwardRef, ComponentProps } from "react";

import cn from "classnames";

interface LinkButtonProps extends ComponentProps<"button"> {
  underlined?: boolean;
}

const LinkButton = forwardRef<HTMLButtonElement, LinkButtonProps>(
  ({ className = "", underlined = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        className={cn(
          `text-blue-600 hover:text-blue-400 font-medium transition-colors duration-200 ease-in-out`,
          { underline: underlined },
          className
        )}
        {...props}
      />
    );
  }
);

export default LinkButton;
