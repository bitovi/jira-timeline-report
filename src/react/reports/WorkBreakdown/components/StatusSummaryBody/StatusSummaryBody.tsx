import React from 'react';
import type { Card } from '../../types';
import type { AdfBlock } from '../../helpers/adfToBlocks';

export interface StatusSummaryBodyProps {
  card: Card;
  fontSize?: string;
}

const renderListItems = (items: AdfBlock[][], keyPrefix: string) =>
  items.map((item, i) => (
    <li key={`${keyPrefix}-${i}`}>
      {item.length === 1 && item[0].type === 'paragraph'
        ? item[0].text
        : item.map((block, j) => renderBlock(block, `${keyPrefix}-${i}-${j}`))}
    </li>
  ));

/** Maps a structured {@link AdfBlock} to real semantic HTML — `prose` (below) styles it. */
const renderBlock = (block: AdfBlock, key: string): React.ReactNode => {
  switch (block.type) {
    case 'orderedList':
      return (
        <ol key={key} start={block.start !== 1 ? block.start : undefined}>
          {renderListItems(block.items, key)}
        </ol>
      );
    case 'bulletList':
      return <ul key={key}>{renderListItems(block.items, key)}</ul>;
    case 'heading': {
      const Tag = `h${Math.min(Math.max(block.level, 1), 6)}` as keyof JSX.IntrinsicElements;
      return <Tag key={key}>{block.text}</Tag>;
    }
    case 'blockquote':
      return <blockquote key={key}>{block.text}</blockquote>;
    case 'codeBlock':
      return (
        <pre key={key}>
          <code>{block.text}</code>
        </pre>
      );
    case 'paragraph':
    default:
      return (
        <p key={key} className="whitespace-pre-line">
          {block.text}
        </p>
      );
  }
};

/**
 * Narrative "Status Summary" content, rendered above the existing status/matrix body (which
 * already shows the "Target Delivery" date and child rows) — additive, not a replacement. Renders
 * real `<ol>`/`<ul>`/`<p>` elements (not flattened text) inside a Tailwind `prose` container, so
 * lists/headings get proper semantic markup and typography for free. MVP has no option to hide
 * the swatches; that's a fast follow (see requirements.md).
 */
export const StatusSummaryBody: React.FC<StatusSummaryBodyProps> = ({ card, fontSize = '' }) => {
  const blocks = card.statusSummary?.blocks;
  if (!blocks?.length) {
    return null;
  }
  return (
    <div
      className={`prose prose-sm prose-neutral max-w-none px-2.5 pt-1.5 pb-1 prose-p:my-0 prose-ul:my-0 prose-ol:my-0 prose-li:my-0 ${fontSize}`}
    >
      {blocks.map((block, i) => renderBlock(block, `${i}`))}
    </div>
  );
};
