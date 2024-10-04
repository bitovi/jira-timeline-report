import type { FC, ReactNode } from "react";

import React from "react";
import { useAccordion } from "../Accordion";

interface AccordionTitleProps {
  children: ReactNode;
}

const AccordionTitle: FC<AccordionTitleProps> = ({ children }) => {
  const { isOpen, setIsOpen } = useAccordion();

  return (
    <div className="flex items-center justify-between p-4 cursor-pointer bg-white" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex items-center space-x-2">
        <svg
          className={`w-4 h-4 transition-transform transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>

        <span className="font-medium text-gray-800">{children}</span>
      </div>
    </div>
  );
};

export default AccordionTitle;
