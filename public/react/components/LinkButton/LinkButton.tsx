import type { ComponentProps, FC } from "react";

import React from "react";

interface LinkButtonProps extends ComponentProps<"button"> {}

const LinkButton: FC<LinkButtonProps> = ({ className, ...props }) => {
  return (
    <button
      className={`text-blue-600 hover:text-blue-400 underline font-medium transition-colors duration-200 ease-in-out ${className}`}
      {...props}
    />
  );
};

export default LinkButton;
