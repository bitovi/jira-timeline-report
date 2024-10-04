import React, { createContext, FC, ReactNode, useContext, useState } from "react";

const AccordionContext = createContext<{ isOpen: boolean; setIsOpen: (isOpen: boolean) => void } | null>(null);

export const useAccordion = () => {
  const context = useContext(AccordionContext);

  if (!context) {
    throw new Error("must use accordion in proper context");
  }

  return context;
};

const Accordion: FC<{ children: ReactNode }> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(true);

  return (
    <AccordionContext.Provider value={{ isOpen, setIsOpen }}>
      <div>{children}</div>
    </AccordionContext.Provider>
  );
};

export default Accordion;