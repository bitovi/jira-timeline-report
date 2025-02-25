import type { FC, ReactNode } from "react";

import React from "react";

interface FilterGridProps {
  children: ReactNode;
}

const FiltersGrid: FC<FilterGridProps> = ({ children }) => {
  return <div className="grid grid-cols-[200px_1fr] gap-6">{children}</div>;
};

export default FiltersGrid;
