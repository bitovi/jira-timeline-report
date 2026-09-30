import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';
import { Label } from '@atlaskit/form';

import JqlEditor from '../JqlEditor';

interface LoadBlockersProps {
  loadBlockers: boolean;
  setLoadBlockers: (newLoad: boolean) => void;
  blockerJql: string;
  setBlockerJql: (blockerJql: string) => void;
}

const LoadBlockers: FC<LoadBlockersProps> = ({ loadBlockers, blockerJql, setBlockerJql, setLoadBlockers }) => {
  const loadBlockersId = useId();

  return (
    <div className="flex flex-col gap-2">
      <div className="flex gap-1">
        <Checkbox
          id={loadBlockersId}
          className="self-start align-middle h-6 mr-0.5"
          isChecked={loadBlockers}
          onChange={(ev) => setLoadBlockers(ev.target.checked)}
        />
        <label htmlFor={loadBlockersId}>Load all blockers recursively of JQL specified issues</label>
      </div>
      {loadBlockers && (
        <div className="flex flex-col gap-1 pl-6">
          {/* Caption only — the editor labels its own combobox, so there's no control to associate. */}
          <Label htmlFor="">Optional blocker JQL filters</Label>
          <JqlEditor query={blockerJql} onUpdate={setBlockerJql} />
        </div>
      )}
    </div>
  );
};

export default LoadBlockers;
