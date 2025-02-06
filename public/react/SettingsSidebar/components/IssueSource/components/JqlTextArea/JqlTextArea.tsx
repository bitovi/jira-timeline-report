import type { FC } from "react";

import { Label } from "@atlaskit/form";
import VisuallyHidden from "@atlaskit/visually-hidden";
import React from "react";
import TextArea from "@atlaskit/textarea";

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
    <div className="flex items-end flex-col">
      <VisuallyHidden>
        <Label htmlFor="jql-text-area">Add your JQL</Label>
      </VisuallyHidden>
      <TextArea
        id="jql-text-area"
        resize="none"
        className="!min-h-72"
        placeholder="issueType in (Epic, Story) order by Rank"
        value={jql}
        onChange={({ target }) => setJql(target.value)}
      />
      <div className="text-xs h-[26px] pt-1">
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
