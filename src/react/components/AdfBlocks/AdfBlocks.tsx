import type { FC, ReactNode } from 'react';
import type { AdfBlock, AdfInline } from './adfToBlocks';

import React from 'react';

export interface AdfBlocksProps {
  /** Blocks from {@link adfToBlocks}. */
  blocks: AdfBlock[];
  /**
   * Classes for the wrapper. Callers own the typography, because the two current ones want different
   * scales — a Work Breakdown card is dense and a document comment is body copy — and `prose` is how
   * both get semantic HTML styled without either writing per-element rules.
   */
  className?: string;
}

/**
 * One run of inline content, with its marks as nested elements.
 *
 * The nesting order is fixed rather than following the order Jira listed the marks in: `<strong><em>` and
 * `<em><strong>` render identically, and a stable order keeps the markup predictable to test and style.
 * A link goes outermost so the whole marked-up run is clickable.
 */
const renderInline = (content: AdfInline[], keyPrefix: string) =>
  content.map((run, i) => {
    const key = `${keyPrefix}-i${i}`;

    if (run.type === 'break') {
      return <br key={key} />;
    }

    let node: ReactNode = run.text;

    if (run.code) {
      node = <code>{node}</code>;
    }
    if (run.strong) {
      node = <strong>{node}</strong>;
    }
    if (run.em) {
      node = <em>{node}</em>;
    }
    if (run.underline) {
      node = <u>{node}</u>;
    }
    if (run.strike) {
      node = <s>{node}</s>;
    }
    if (run.href) {
      // `adfToBlocks` has already dropped any scheme that could execute; this only has to avoid handing
      // the opened tab a reference back to this one.
      node = (
        <a href={run.href} target="_blank" rel="noopener noreferrer">
          {node}
        </a>
      );
    }

    return <React.Fragment key={key}>{node}</React.Fragment>;
  });

const renderListItems = (items: AdfBlock[][], keyPrefix: string) =>
  items.map((item, i) => (
    <li key={`${keyPrefix}-${i}`}>
      {item.length === 1 && item[0].type === 'paragraph'
        ? renderInline(item[0].content, `${keyPrefix}-${i}`)
        : item.map((block, j) => renderBlock(block, `${keyPrefix}-${i}-${j}`))}
    </li>
  ));

/** Maps a structured {@link AdfBlock} to real semantic HTML — the caller's `prose` styles it. */
const renderBlock = (block: AdfBlock, key: string): ReactNode => {
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
      return <Tag key={key}>{renderInline(block.content, key)}</Tag>;
    }
    case 'blockquote':
      return <blockquote key={key}>{renderInline(block.content, key)}</blockquote>;
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
          {renderInline(block.content, key)}
        </p>
      );
  }
};

/**
 * Jira rich text (ADF), rendered as semantic HTML.
 *
 * Pure and prop-driven: it takes {@link AdfBlock}s rather than an ADF document, so it stories and
 * unit-tests with hand-written fixtures and the walking stays separately testable in
 * `adfToBlocks.test.ts`.
 *
 * Shared by the Work Breakdown report's "Status Summary" (`StatusSummaryBody`) and a document's
 * latest-comment value — the same walker and the same mapper, so Jira rich text looks the same
 * everywhere in the app. See spec/016-report-of-reports/007-latest-comment-report Phase 3.
 *
 * **What it renders:** paragraphs, headings, blockquotes, code blocks, ordered and bullet lists (nested),
 * hard breaks, and the marks bold, italic, underline, strikethrough, inline code, and links.
 *
 * **What it doesn't**, because `adfToBlocks` doesn't produce it: tables, panels, media, mentions, emoji,
 * and text colour. Those degrade to their text content. Extending the walker is the way to close that,
 * and both callers gain from it at once.
 */
export const AdfBlocks: FC<AdfBlocksProps> = ({ blocks, className = '' }) => {
  if (!blocks.length) {
    return null;
  }

  return <div className={className}>{blocks.map((block, i) => renderBlock(block, `${i}`))}</div>;
};

export default AdfBlocks;
