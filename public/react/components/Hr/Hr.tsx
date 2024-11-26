import type { FC } from "react";

import React from "react";

interface HrProps {
  className?: string;
}

const Hr: FC<HrProps> = ({ className }) => {
  return <hr className={`h-px my-4 bg-gray-200 border-0 dark:bg-gray-700 ${className || ""}`}></hr>;
};

export default Hr;
