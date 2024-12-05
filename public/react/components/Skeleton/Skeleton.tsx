import type { FC } from "react";

import React from "react";

type SkeletonProps = {
  className?: string;
  width?: string | number;
  height?: string | number;
  rounded?: string;
};

const Skeleton: FC<SkeletonProps> = ({ className = "", width = "100%", height = "1rem", rounded = "sm" }) => {
  return <div className={`bg-gray-200 animate-pulse rounded-${rounded} ${className} `} style={{ width, height }} />;
};

export default Skeleton;
