import React, { FC, ReactNode } from 'react';
import Lozenge from '@atlaskit/lozenge';
import { useTheme } from '../../../services/theme';

const StatusKey: FC = () => {
  const theme = useTheme();

  return (
    <div className="flex flex-wrap gap-x-4 gap-y-3 p-4 justify-between bg-white z-[50]">
      <div className="flex gap-x-8">
        <ItemStatus icon={<img className="m-0.5" src="/images/empty-set.svg" />}>Unknown dates</ItemStatus>
        <ItemStatus icon="←">Dates are in the past outside this view</ItemStatus>
        <ItemStatus icon="→">Dates are in the future outside this view</ItemStatus>
      </div>
      <div className="flex gap-x-1">
        {theme.map(({ backgroundCssVar, textCssVar, label }) => (
          <Lozenge
            key={label}
            style={{
              backgroundColor: `var(${backgroundCssVar})`,
              color: `var(${textCssVar})`,
            }}
          >
            {label}
          </Lozenge>
        ))}
      </div>
    </div>
  );
};

export default StatusKey;

interface ItemStatusProps {
  icon: ReactNode;
  children: ReactNode;
}

const ItemStatus: FC<ItemStatusProps> = ({ icon, children }) => {
  return (
    <div className="flex space-x-2 content-center">
      <div className="color-text-and-bg-notstarted text-xs w-4 h-4 shrink-0 relative flex content-center justify-center rounded-full">
        {icon}
      </div>
      <div className="color-text-notstarted text-xs">{children}</div>
    </div>
  );
};
