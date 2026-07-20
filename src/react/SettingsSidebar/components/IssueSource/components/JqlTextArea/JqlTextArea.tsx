import type { FC } from 'react';

import React from 'react';

import JqlEditor from '../JqlEditor';

interface JQLTextAreaProps {
  jql: string;
  setJql: (jql: string) => void;
  isLoading: boolean;
  isSuccess: boolean;
  totalChunks: number;
  receivedChunks: number;
  numberOfIssues: number;
}

const JQLTextArea: FC<JQLTextAreaProps> = ({
  jql,
  setJql,
  isLoading,
  isSuccess,
  receivedChunks,
  totalChunks,
  numberOfIssues,
}) => {
  return (
    <div className="flex flex-col">
      <JqlEditor query={jql} onUpdate={setJql} isSearching={isLoading} />
      <div className="text-xs h-[26px] pt-1 self-end">
        {isLoading &&
          (totalChunks ? (
            <>
              Loaded {receivedChunks} of {totalChunks} issues
            </>
          ) : (
            <>Loading issues ...</>
          ))}
        {isSuccess && <>Loaded {numberOfIssues} issues</>}
      </div>
    </div>
  );
};

export default JQLTextArea;
