import React, { FC, ReactNode } from 'react';
import cn from 'classnames';

const positionVariants = {
  left: '-translate-x-1/2',
  right: 'translate-x-1/2',
} as const;

const dotColorVariants = {
  lightBlue: 'bg-blue-200',
  blue: 'bg-blue-500',
  green: 'bg-green-400',
} as const;

const AutoSchedulerFooterKey: FC<{
  position?: 'left' | 'right';
  dotColor: 'lightBlue' | 'blue' | 'green';
  children: ReactNode;
}> = ({ position, dotColor, children }) => {
  return (
    <div
      className={cn(
        'text-center flex items-center flex-col w-[30%] text-xs',
        position ? positionVariants[position] : null,
      )}
    >
      <div className={cn('w-3 h-3  rounded-full mb-2 mt-1', dotColorVariants[dotColor])} />
      {children}
    </div>
  );
};

export default AutoSchedulerFooterKey;
