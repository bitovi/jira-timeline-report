import type { FC, ReactNode } from 'react';

import React from 'react';

export interface NodeRowProps {
  /**
   * The node's id, published to the DOM so the pin's outside-press check can find the pinned row —
   * and so a test can hover the row a control belongs to.
   */
  nodeId?: string;
  /**
   * The row's leading caret. Only sections pass one; everything else omits it and reserves no space
   * for a control it will never have.
   */
  caret?: ReactNode;
  /** The row's label: an editable section title, a report's name, an inline value. */
  children: ReactNode;
  /** The reorder / remove cluster. It hides itself — the row only places it. */
  controls?: ReactNode;
  /** The pointer is in this node, or in something inside it. */
  isHovered?: boolean;
  /** The click-pinned row — what the design calls "selected". */
  isPinned?: boolean;
  onClick?: () => void;
}

/**
 * One row of the document outline: a caret slot, a label, and a right-aligned control cluster.
 *
 * Every node in the document gets exactly one of these, and it's the whole of the node's *chrome* —
 * a report's chart and a section's children render beneath it, not inside it. Pure and prop-driven
 * like `SectionTitle` and `InlineValue`, so it stories without a document (or Jira) around it.
 * See spec/016-report-of-reports/004-redesign.
 *
 * The two-column grid is what keeps the label from shifting when the controls fade in: the second
 * track is sized `auto` whether or not the cluster is visible, since hiding it is an opacity change
 * and opacity doesn't touch layout.
 */
export const NodeRow: FC<NodeRowProps> = ({ nodeId, caret, children, controls, isHovered, isPinned, onClick }) => (
  <div
    data-node-row=""
    data-node-id={nodeId}
    onClick={onClick}
    className={[
      'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2 min-h-10 px-2 rounded transition-colors duration-150',
      isPinned ? 'bg-blue-101 ring-1 ring-inset ring-blue-300' : isHovered ? 'bg-neutral-201' : '',
    ].join(' ')}
  >
    <div className="flex items-center gap-1 min-w-0">
      {caret}
      {children}
    </div>
    {controls}
  </div>
);

export default NodeRow;
