import type { ReactNode, FC } from "react";

import React from "react";

import { useAccordion } from "../Accordion";

interface AccordionContentProps {
  children: ReactNode;
}

const AccordionContent: FC<AccordionContentProps> = ({ children }) => {
  const { isOpen } = useAccordion();

  return isOpen && <div className="p-4">{children}</div>;
};

export default AccordionContent;
