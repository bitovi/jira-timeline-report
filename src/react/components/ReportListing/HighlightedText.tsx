import type { FC } from 'react';

import React from 'react';

import { highlightSegments } from './report-search';

export interface HighlightedTextProps {
  text: string;
  /** The active search query. Empty renders `text` unchanged. */
  query?: string;
}

/** Renders `text` with every case-insensitive occurrence of `query` wrapped in a `<mark>`. */
export const HighlightedText: FC<HighlightedTextProps> = ({ text, query = '' }) => (
  <>
    {highlightSegments(text, query).map((segment, index) =>
      segment.matched ? (
        <mark key={index}>{segment.text}</mark>
      ) : (
        <React.Fragment key={index}>{segment.text}</React.Fragment>
      ),
    )}
  </>
);

export default HighlightedText;
