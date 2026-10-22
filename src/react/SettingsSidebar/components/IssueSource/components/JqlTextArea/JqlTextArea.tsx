import type { FC } from 'react';

import React from 'react';

import JqlEditor from '../JqlEditor';

interface JQLTextAreaProps {
  jql: string;
  setJql: (jql: string) => void;
  isLoading: boolean;
  /** Muted text in the editor's footer strip, below the input. */
  helperText?: string;
}

const JQLTextArea: FC<JQLTextAreaProps> = ({ jql, setJql, isLoading, helperText }) => {
  return <JqlEditor query={jql} onUpdate={setJql} isSearching={isLoading} helperText={helperText} />;
};

export default JQLTextArea;
