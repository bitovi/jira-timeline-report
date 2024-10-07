import type { FC, ReactNode } from "react";

import React from "react";
import ChevronRightLargeIcon from "@atlaskit/icon/glyph/chevron-right";
import ChevronDownLargeIcon from "@atlaskit/icon/glyph/chevron-down";

import { useAccordion } from "../Accordion";

interface AccordionTitleProps {
  children: ReactNode;
}

const AccordionTitle: FC<AccordionTitleProps> = ({ children }) => {
  const { isOpen, setIsOpen } = useAccordion();

  const Icon = isOpen ? ChevronDownLargeIcon : ChevronRightLargeIcon;

  return (
    <div className="flex items-center justify-between p-4 cursor-pointer bg-white" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex items-center space-x-2">
        <Icon label={isOpen ? "open" : "closed"} />
        <div>{children}</div>
      </div>
    </div>
  );
};

export default AccordionTitle;
