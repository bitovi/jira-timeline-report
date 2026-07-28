import type { FC } from 'react';
import type { LayoutPath } from '../model/sections';

import React from 'react';
import { IconButton } from '@atlaskit/button/new';
import ArrowUpIcon from '@atlaskit/icon/core/arrow-up';
import ArrowDownIcon from '@atlaskit/icon/core/arrow-down';
import DeleteIcon from '@atlaskit/icon/core/delete';

import { useReportLayout } from '../../../services/report-layout';
import { canMoveNodeAt, moveNodeAt, removeNodeAt } from '../model/sections';

export interface NodeControlsProps {
  /** Position of the node these controls act on. */
  path: LayoutPath;
  /**
   * Names the node in each control's accessible label — "Move Alpha up" rather than three "Move up"
   * buttons a screen reader (or a test) can't tell apart.
   */
  label: string;
}

/**
 * Reorder / remove controls for one document node. See spec/016-report-of-reports Phase 4.
 *
 * Reads the tree from the layout context rather than taking it as a prop, so it can sit at any depth
 * without threading callbacks through the recursive renderer. Moves are confined to the node's own
 * container, so the arrows are disabled at either end rather than silently re-parenting.
 */
export const NodeControls: FC<NodeControlsProps> = ({ path, label }) => {
  const { sections, setSections } = useReportLayout();

  // `ml-auto` keeps the controls right-aligned even when the node has no title beside them.
  return (
    <div className="flex gap-1 ml-auto print-hidden">
      <IconButton
        icon={ArrowUpIcon}
        label={`Move ${label} up`}
        appearance="subtle"
        spacing="compact"
        isDisabled={!canMoveNodeAt(sections, path, -1)}
        onClick={() => setSections(moveNodeAt(sections, path, -1))}
      />
      <IconButton
        icon={ArrowDownIcon}
        label={`Move ${label} down`}
        appearance="subtle"
        spacing="compact"
        isDisabled={!canMoveNodeAt(sections, path, 1)}
        onClick={() => setSections(moveNodeAt(sections, path, 1))}
      />
      <IconButton
        icon={DeleteIcon}
        label={`Remove ${label}`}
        appearance="subtle"
        spacing="compact"
        onClick={() => setSections(removeNodeAt(sections, path))}
      />
    </div>
  );
};
