import type { FC } from 'react';

import React from 'react';
import { DropdownItemGroup } from '@atlaskit/dropdown-menu';

const EmptyView: FC = () => {
  return (
    <DropdownItemGroup>
      <div className="max-w-64 flex flex-col items-center gap-4 p-4 text-center">
        <img src="/assets/no-reports.png" />
        <p className="text-xl font-semibold">You don't have any saved reports</p>
        <p className="text-sm">When you save your first report, you will be able to access it here.</p>
      </div>
    </DropdownItemGroup>
  );
};

export default EmptyView;
