import React, { FC } from 'react';
import AutoSchedulerFooterKey from './components/AutoSchedulerFooterKey';

export const AutoSchedulerFooter: FC = () => {
  return (
    <div className="p-2 rounded-lg bg-white m-2 mb-10">
      <div className="text-base font-semibold shrink">KEY</div>

      <div className="flex justify-center">
        <div className="relative w-1/2">
          <div className="absolute bg-gradient-to-r from-blue-200 to-green-200 from-85% to-95% h-1 top-1.5 border-box w-full" />
          <div className="work-item border-solid border relative bg-gradient-to-r from-blue-500 to-green-400 from-45% to-55% h-4 border-box rounded w-1/2 left-1/2" />
          <div className="flex justify-between pt-2">
            <AutoSchedulerFooterKey position="left" dotColor="lightBlue">
              Earliest development might start within risk parameters
            </AutoSchedulerFooterKey>

            <AutoSchedulerFooterKey dotColor="blue">
              Latest development must start to be within risk parameters
            </AutoSchedulerFooterKey>

            <AutoSchedulerFooterKey position="right" dotColor="green">
              Latest development must finish to be within risk parameters
            </AutoSchedulerFooterKey>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoSchedulerFooter;
