import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';
import { Label } from '@atlaskit/form';
import Textfield from '@atlaskit/textfield';

import Hr from '../../../../../components/Hr';
import { Accordion, AccordionContent, AccordionTitle } from '../../../../../components/Accordion';

interface LoadChildrenProps {
  loadChildren: boolean;
  setLoadChildren: (newLoad: boolean) => void;
  childJql: string;
  setChildJql: (childJql: string) => void;
}

const LoadChildren: FC<LoadChildrenProps> = ({ loadChildren, childJql, setChildJql, setLoadChildren }) => {
  const loadChildrenId = useId();
  const childJqlId = useId();

  return (
    <div>
      <div className="flex flex-col gap-3 py-4">
        <div className="flex gap-1 items-center">
          <Checkbox
            id={loadChildrenId}
            className="self-start align-middle h-6 mr-0.5"
            isChecked={loadChildren}
            onChange={(ev) => setLoadChildren(ev.target.checked)}
          />
          <label htmlFor={loadChildrenId}>Load all children of JQL specified issues</label>
        </div>
        {loadChildren && (
          <div className="flex flex-col gap-1">
            <Label htmlFor={childJqlId}>Optional children JQL filters</Label>
            <Textfield
              type="text"
              id={childJqlId}
              value={childJql}
              onChange={({ currentTarget }) => {
                setChildJql(currentTarget.value);
              }}
            />
          </div>
        )}
      </div>
      <Hr />
    </div>
  );
};

export default LoadChildren;
