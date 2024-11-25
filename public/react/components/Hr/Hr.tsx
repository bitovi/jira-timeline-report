import type { FC } from "react";

import React from "react";

const Hr: FC<{ className?: string }> = ({ className }) => {
  return <hr className={`h-px my-4 bg-gray-200 border-0 dark:bg-gray-700 ${className}`}></hr>;
};

export default Hr;
