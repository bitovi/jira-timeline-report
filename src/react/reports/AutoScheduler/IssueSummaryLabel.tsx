import type { FC, ReactNode } from 'react';

import React from 'react';

import { TruncatedText } from './TruncatedText';
import { gridLayer } from './z-layers';

interface IssueSummaryLabelProps {
  summary: string;
  /** Absent when the issue has no Jira link — the summary then renders as plain text. */
  url?: string;
  openInNewTab?: boolean;
  /** Extra classes for the text itself. The two call sites differ only in their hover treatment. */
  textClassName?: string;
  gridRowStart: number;
  /** Rendered before the summary, e.g. the freeze toggle. */
  leading?: ReactNode;
  /** On a gray row band; the pinned cell takes its color so the band runs under it. */
  striped?: boolean;
  /** The label and the chart are separate grid cells, so a row learns it's hovered from each. */
  onHoverChange?: (hovered: boolean) => void;
}

/**
 * The pinned `what`-column cell for an issue: its summary, clipped to the column via
 * `TruncatedText`, linked to Jira when the issue has a url. Fills the row's height so its opaque
 * background matches the row band.
 */
export const IssueSummaryLabel: FC<IssueSummaryLabelProps> = ({
  summary,
  url,
  openInNewTab = false,
  textClassName,
  gridRowStart,
  leading,
  striped = false,
  onHoverChange,
}) => (
  <div
    className={`self-stretch flex items-center pr-2 max-w-sm sticky left-0 ${striped ? 'bg-neutral-20' : 'bg-white'} ${leading ? 'group gap-1 pl-1' : 'pl-5'}`}
    style={{ zIndex: gridLayer.labelColumn, gridRow: gridRowStart, gridColumnStart: 'what' }}
    onMouseEnter={onHoverChange && (() => onHoverChange(true))}
    onMouseLeave={onHoverChange && (() => onHoverChange(false))}
  >
    {leading}
    <TruncatedText
      text={summary}
      hasFocusableChild={!!url}
      className={['text-gray-600', 'min-w-0', textClassName].filter(Boolean).join(' ')}
    >
      {url ? (
        <a href={url} target={openInNewTab ? '_blank' : undefined}>
          {summary}
        </a>
      ) : (
        summary
      )}
    </TruncatedText>
  </div>
);
