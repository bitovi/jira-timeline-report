import type { FC } from 'react';

import React, { useId } from 'react';
import Toggle from '@atlaskit/toggle';
import { useRouteData } from '../../../../../../hooks/useRouteData';

const useWorkBreakdown = () => {
  const [workBreakdown, setWorkBreakdown] = useRouteData<boolean>('primaryReportBreakdown');

  return [workBreakdown, setWorkBreakdown] as const;
};

const ShowWorkBreakdown: FC = () => {
  const id = useId();
  const [workBreakdown, setWorkBreakdown] = useWorkBreakdown();

  return (
    <div className="flex items-center gap-2">
      <Toggle id={id} isChecked={workBreakdown} onChange={({ target }) => setWorkBreakdown(target.checked)} />
      <label htmlFor={id} className="text-sm">
        Show work breakdown
      </label>
    </div>
  );
};

export default ShowWorkBreakdown;
