import type { FC, ReactNode } from 'react';

import React from 'react';
import cn from 'classnames';
import GoBackButton from '../GoBackButton';

interface SidebarLayoutProps {
  className?: string;
  children: ReactNode;
  onGoBack: () => void;
}

const SidebarLayout: FC<SidebarLayoutProps> = ({ children, className, onGoBack }) => {
  return (
    <div className={cn('px-6 py-2 overflow-y-auto h-full', className)}>
      <GoBackButton onGoBack={onGoBack} />
      {children}
    </div>
  );
};

export default SidebarLayout;
