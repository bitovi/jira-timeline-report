import type { FC } from 'react';

import React, { useId } from 'react';
import { Checkbox } from '@atlaskit/checkbox';

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
        <label htmlFor={loadBlockersId}>Blockers of queried issues, recursively</label>
      </div>
      {loadBlockers && (
        <div className="flex flex-col pl-6">
          <JqlEditor query={blockerJql} onUpdate={setBlockerJql} helperText="Filter blockers with JQL (optional)" />
        </div>
      )}
    </div>
  );
};

export default LoadBlockers;
