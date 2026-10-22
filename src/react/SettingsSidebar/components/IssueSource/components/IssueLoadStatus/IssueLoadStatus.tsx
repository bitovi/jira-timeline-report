import type { FC } from 'react';

import React from 'react';

interface IssueLoadStatusProps {
  isLoading: boolean;
  isSuccess: boolean;
  totalChunks: number;
  receivedChunks: number;
  numberOfIssues: number;
}

/** The "Loaded N issues" readout shown beside the Sources panel's "Apply" button. */
const IssueLoadStatus: FC<IssueLoadStatusProps> = ({
  isLoading,
  isSuccess,
  totalChunks,
  receivedChunks,
  numberOfIssues,
}) => {
  return (
    <span className="text-xs text-neutral-801">
      {isLoading &&
        (totalChunks ? (
          <>
            Loaded {receivedChunks} of {totalChunks} issues
          </>
        ) : (
          <>Loading issues ...</>
        ))}
      {!isLoading && isSuccess && <>Loaded {numberOfIssues} issues</>}
    </span>
  );
};

export default IssueLoadStatus;
