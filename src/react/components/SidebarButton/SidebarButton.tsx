import type { FC, ComponentProps } from 'react';

import React from 'react';

interface SidebarButtonProps extends ComponentProps<'button'> {
  isActive?: boolean;
}

const getButtonClasses = (isActive: boolean, className: ComponentProps<'button'>['className']) => {
  return [
    'p-2',
    'flex',
    'align-center',
    'gap-2',
    'text-sm',
    'text-slate-300',
    'w-full',
    'text-left',
    isActive ? 'bg-blue-50' : 'bg-inherit',
    'focus:bg-blue-50',
    'hover:bg-blue-50',
    className,
  ].join(' ');
};

const SidebarButton: FC<SidebarButtonProps> = ({ isActive, className, children, ...buttonProps }) => {
  return (
    <button className={getButtonClasses(!!isActive, className)} {...buttonProps}>
      {children}
    </button>
  );
};

export default SidebarButton;
