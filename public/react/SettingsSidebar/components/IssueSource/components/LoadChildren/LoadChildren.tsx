import type { FC } from "react";

import React from "react";
import { Checkbox } from "@atlaskit/checkbox";
import { Label } from "@atlaskit/form";
import Textfield from "@atlaskit/textfield";

import Hr from "../../../../../components/Hr";
import { Accordion, AccordionContent, AccordionTitle } from "../../../../../components/Accordion";

interface LoadChildrenProps {
  loadChildren: boolean;
  setLoadChildren: (newLoad: boolean) => void;
  childJql: string;
  setChildJql: (childJql: string) => void;
}

const LoadChildren: FC<LoadChildrenProps> = ({
  loadChildren,
  childJql,
  setChildJql,
  setLoadChildren,
}) => {
  return (
    <div>
      <Hr />
      <Accordion startsOpen>
        <AccordionTitle>
          <p className="font-semibold">Load children</p>
        </AccordionTitle>
        <AccordionContent>
          <div className="flex flex-col gap-3 py-4">
            <div className="flex gap-1 items-center">
              <Checkbox
                id="loadChildren"
                name="loadChildren"
                className="self-start align-middle h-6 mr-0.5"
                isChecked={loadChildren}
                onChange={(ev) => setLoadChildren(ev.target.checked)}
              />
              <label htmlFor="loadChildren">Load all children of JQL specified issues</label>
            </div>
            {loadChildren && (
              <div className="flex flex-col gap-1">
                <Label htmlFor="childJql">Optional children JQL filters</Label>
                <Textfield
                  type="text"
                  id="childJql"
                  value={childJql}
                  onChange={(ev) => {
                    // ADS Textfield components don't have the correct types
                    const target = ev.target as unknown as { value: string };
                    setChildJql(target.value);
                  }}
                />
              </div>
            )}
          </div>
        </AccordionContent>
      </Accordion>
      <Hr />
    </div>
  );
};

export default LoadChildren;
