import type { FC } from 'react';
import type { LayoutPath } from '../model/sections';

import React, { useState } from 'react';
import ArrowUpIcon from '@atlaskit/icon/core/arrow-up';
import ArrowDownIcon from '@atlaskit/icon/core/arrow-down';

import { useReportLayout } from '../../../services/report-layout';
import { canMoveNodeAt, moveNodeAt, removeNodeAt } from '../model/sections';
import { useDocumentEditing } from './DocumentEditing';
import { DeleteConfirm } from './DeleteConfirm';
import { RowButton } from './RowButton';

export interface NodeControlsProps {
  /** Position of the node these controls act on. */
  path: LayoutPath;
  /**
   * Names the node in each control's accessible label — "Move Alpha up" rather than three "Move up"
   * buttons a screen reader (or a test) can't tell apart.
   */
  label: string;
  /** The node's id. The pin is keyed by id so it survives the very move it was clicked to make. */
  nodeId: string;
  /** Whether the node holds anything, which changes what the delete confirm says. */
  hasChildren?: boolean;
}

/**
 * Reorder / remove controls for one document node. See spec/016-report-of-reports Phase 4, and
 * .../004-redesign §5 for the hover behavior.
 *
 * Reads the tree from the layout context rather than taking it as a prop, so it can sit at any depth
 * without threading callbacks through the recursive renderer. Moves are confined to the node's own
 * container, so the arrows are disabled at either end rather than silently re-parenting.
 *
 * Invisible at rest: revealed while the pointer is anywhere in the node (its chart included), while
 * the row is pinned, or while the confirm popover is up. Opacity rather than mounting, so nothing on
 * the row moves as it appears and the cluster's width is reserved either way. Keyboard users get it
 * from `focus-within`, which is CSS — there's nothing to make stateful about tabbing into it.
 */
export const NodeControls: FC<NodeControlsProps> = ({ path, label, nodeId, hasChildren = false }) => {
  const { sections, setSections } = useReportLayout();
  const { isHovered, isPinned } = useDocumentEditing();
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);

  const isVisible = isHovered(path) || isPinned(nodeId) || isConfirmOpen;

  return (
    <div
      data-testid="node-controls"
      data-visible={isVisible}
      className={`flex items-center transition-opacity duration-150 print-hidden ${
        isVisible
          ? 'opacity-100'
          : 'opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto'
      }`}
    >
      <RowButton
        icon={ArrowUpIcon}
        label={`Move ${label} up`}
        disabled={!canMoveNodeAt(sections, path, -1)}
        onClick={() => setSections(moveNodeAt(sections, path, -1))}
      />
      <RowButton
        icon={ArrowDownIcon}
        label={`Move ${label} down`}
        disabled={!canMoveNodeAt(sections, path, 1)}
        onClick={() => setSections(moveNodeAt(sections, path, 1))}
      />
      <span aria-hidden="true" className="mx-1 h-4 w-px bg-neutral-301" />
      <DeleteConfirm
        label={label}
        hasChildren={hasChildren}
        onConfirm={() => setSections(removeNodeAt(sections, path))}
        onOpenChange={setIsConfirmOpen}
      />
    </div>
  );
};

export default NodeControls;
