import React from 'react';
import type { Card } from '../../types';
import { AdfBlocks } from '../../../../components/AdfBlocks';

export interface StatusSummaryBodyProps {
  card: Card;
  fontSize?: string;
}

/**
 * Narrative "Status Summary" content, rendered above the existing status/matrix body (which
 * already shows the "Target Delivery" date and child rows) — additive, not a replacement. Renders
 * real `<ol>`/`<ul>`/`<p>` elements (not flattened text) inside a Tailwind `prose` container, so
 * lists/headings get proper semantic markup and typography for free. MVP has no option to hide
 * the swatches; that's a fast follow (see requirements.md).
 *
 * The block-to-HTML mapping lives in the shared {@link AdfBlocks}, so Jira rich text renders the
 * same here and in a report-of-reports document's latest-comment value.
 */
export const StatusSummaryBody: React.FC<StatusSummaryBodyProps> = ({ card, fontSize = '' }) => {
  const blocks = card.statusSummary?.blocks;
  if (!blocks?.length) {
    return null;
  }
  return (
    <AdfBlocks
      blocks={blocks}
      className={`prose prose-sm prose-neutral max-w-none px-2.5 pt-1.5 pb-1 prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-li:my-0 ${fontSize}`}
    />
  );
};
