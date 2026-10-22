import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';

import { Accordion, AccordionContent, AccordionTitle } from '../../../../../components/Accordion';
import JqlEditor from '../JqlEditor';

interface LoadChildrenProps {
  loadChildren: boolean;
  setLoadChildren: (newLoad: boolean) => void;
  childJql: string;
  setChildJql: (childJql: string) => void;
}

const LoadChildren: FC<LoadChildrenProps> = ({ loadChildren, childJql, setChildJql, setLoadChildren }) => {
  const loadChildrenId = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1 items-center">
        <Checkbox
          id={loadChildrenId}
          className="self-start align-middle h-6 mr-0.5"
          isChecked={loadChildren}
          onChange={(ev) => setLoadChildren(ev.target.checked)}
        />
        <label htmlFor={loadChildrenId}>Children of queried issues</label>
      </div>
      {loadChildren && (
        <div className="flex flex-col pl-6">
          <JqlEditor query={childJql} onUpdate={setChildJql} helperText="Filter children with JQL (optional)" />
        </div>
      )}
    </div>
  );
};

export default LoadChildren;
