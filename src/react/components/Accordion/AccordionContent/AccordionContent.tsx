import type { ReactNode, FC } from 'react';

import React from 'react';

import { useAccordion } from '../Accordion';
// temp
interface AccordionContentProps {
  children: ReactNode;
}

const AccordionContent: FC<AccordionContentProps> = ({ children }) => {
  const { isOpen } = useAccordion();

  return isOpen && <div className="px-4 py-0">{children}</div>;
};

export default AccordionContent;
