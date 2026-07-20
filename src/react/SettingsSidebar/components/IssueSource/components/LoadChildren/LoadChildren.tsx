import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';
import { Label } from '@atlaskit/form';

import Hr from '../../../../../components/Hr';
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
            {/* Caption only — the editor labels its own combobox, so there's no control to associate. */}
            <Label htmlFor="">Optional children JQL filters</Label>
            <JqlEditor query={childJql} onUpdate={setChildJql} />
          </div>
        )}
      </div>
      <Hr />
    </div>
  );
};

export default LoadChildren;
