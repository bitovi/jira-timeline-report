/**
 * A vertical list of strings the user reorders, built the way Atlassian's design system documents
 * it: Pragmatic drag and drop for dragging (with the blue drop indicator line), plus a drag handle
 * that is also a menu button offering Move to top / up / down / bottom, so the list works from the
 * keyboard. Every move is announced to screen readers.
 *
 * Controlled: renders `items` and reports each move through `onChange`.
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import {
  draggable,
  dropTargetForElements,
  monitorForElements,
} from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { reorder } from '@atlaskit/pragmatic-drag-and-drop/reorder';
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index';
import { DropIndicator } from '@atlaskit/pragmatic-drag-and-drop-react-drop-indicator/box';
import { DragHandleButton } from '@atlaskit/pragmatic-drag-and-drop-react-accessibility/drag-handle-button';
import { announce, cleanup as cleanupLiveRegion } from '@atlaskit/pragmatic-drag-and-drop-live-region';

import { ABOVE_MODAL_Z_INDEX } from './ColorSwatchPicker';

import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';

interface ReorderableListProps {
  items: readonly string[];
  onChange: (items: string[]) => void;
  /** Accessible name for the list. */
  label: string;
  /** A row's content after its drag handle; defaults to the item text. */
  renderItem?: (item: string) => React.ReactNode;
}

/** Drag data, tagged with the list instance so two lists on a page can't drop into each other. */
type ItemData = { instanceId: symbol; item: string; index: number };

const isItemData = (data: Record<string | symbol, unknown>): data is ItemData =>
  typeof data.instanceId === 'symbol' && typeof data.item === 'string' && typeof data.index === 'number';

/** Spacing between rows, which the drop indicator is drawn halfway across. */
const ROW_GAP = '4px';

export const ReorderableList: React.FC<ReorderableListProps> = ({ items, onChange, label, renderItem }) => {
  const [instanceId] = useState(() => Symbol('reorderable-list'));

  const move = (startIndex: number, finishIndex: number) => {
    if (startIndex === finishIndex) return;
    onChange(reorder({ list: [...items], startIndex, finishIndex }));
    announce(`${items[startIndex]} moved to position ${finishIndex + 1} of ${items.length}`);
  };

  // Latest `move` for the monitor, which subscribes once per instance.
  const moveRef = useRef(move);
  moveRef.current = move;

  useEffect(
    () =>
      monitorForElements({
        canMonitor: ({ source }) => isItemData(source.data) && source.data.instanceId === instanceId,
        onDrop: ({ location, source }) => {
          const target = location.current.dropTargets[0];
          if (!target || !isItemData(source.data) || !isItemData(target.data)) return;
          moveRef.current(
            source.data.index,
            getReorderDestinationIndex({
              startIndex: source.data.index,
              indexOfTarget: target.data.index,
              closestEdgeOfTarget: extractClosestEdge(target.data),
              axis: 'vertical',
            }),
          );
        },
      }),
    [instanceId],
  );

  useEffect(() => cleanupLiveRegion, []);

  return (
    <ul aria-label={label} className="flex flex-col" style={{ gap: ROW_GAP }} data-testid="reorderable-list">
      {items.map((item, index) => (
        <ReorderableRow
          key={item}
          item={item}
          index={index}
          count={items.length}
          instanceId={instanceId}
          onMove={(finishIndex) => move(index, finishIndex)}
          content={renderItem ? renderItem(item) : <span className="truncate">{item}</span>}
        />
      ))}
    </ul>
  );
};

interface ReorderableRowProps {
  item: string;
  index: number;
  count: number;
  instanceId: symbol;
  onMove: (finishIndex: number) => void;
  content: React.ReactNode;
}

const ReorderableRow: React.FC<ReorderableRowProps> = ({ item, index, count, instanceId, onMove, content }) => {
  const rowRef = useRef<HTMLLIElement>(null);
  const handleRef = useRef<HTMLButtonElement | null>(null);
  const [closestEdge, setClosestEdge] = useState<Edge | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const element = rowRef.current;
    const dragHandle = handleRef.current;
    if (!element || !dragHandle) return;
    const data: ItemData = { instanceId, item, index };
    return combine(
      draggable({
        element,
        dragHandle,
        getInitialData: () => data,
        onDragStart: () => setIsDragging(true),
        onDrop: () => setIsDragging(false),
      }),
      dropTargetForElements({
        element,
        canDrop: ({ source }) => isItemData(source.data) && source.data.instanceId === instanceId,
        getData: ({ input }) => attachClosestEdge(data, { element, input, allowedEdges: ['top', 'bottom'] }),
        onDrag: ({ self, source }) => {
          const edge = extractClosestEdge(self.data);
          // No line when it would leave the item where it is: over itself, or the facing edge of a neighbour.
          const sourceIndex = isItemData(source.data) ? source.data.index : -1;
          const noOp =
            source.element === element ||
            (edge === 'top' && sourceIndex === index - 1) ||
            (edge === 'bottom' && sourceIndex === index + 1);
          setClosestEdge(noOp ? null : edge);
        },
        onDragLeave: () => setClosestEdge(null),
        onDrop: () => setClosestEdge(null),
      }),
    );
  }, [instanceId, item, index]);

  const moves = useMemo(
    () => [
      { label: 'Move to top', to: 0, enabled: index > 0 },
      { label: 'Move up', to: index - 1, enabled: index > 0 },
      { label: 'Move down', to: index + 1, enabled: index < count - 1 },
      { label: 'Move to bottom', to: count - 1, enabled: index < count - 1 },
    ],
    [index, count],
  );

  return (
    <li
      ref={rowRef}
      className={`relative flex items-center gap-2 rounded border border-neutral-301 bg-white px-1 py-1 text-sm ${
        isDragging ? 'opacity-40' : ''
      }`}
      data-testid="reorderable-row"
    >
      <DropdownMenu
        placement="bottom-start"
        // The list is used inside a modal; the menu's default z-index would put it behind.
        zIndex={ABOVE_MODAL_Z_INDEX}
        trigger={({ triggerRef, ...triggerProps }) => (
          <DragHandleButton
            {...triggerProps}
            ref={(node: HTMLButtonElement | null) => {
              handleRef.current = node;
              if (typeof triggerRef === 'function') triggerRef(node);
              else if (triggerRef) (triggerRef as React.MutableRefObject<HTMLButtonElement | null>).current = node;
            }}
            label={`Reorder ${item}`}
          />
        )}
      >
        <DropdownItemGroup>
          {moves.map(({ label, to, enabled }) => (
            <DropdownItem key={label} isDisabled={!enabled} onClick={() => onMove(to)}>
              {label}
            </DropdownItem>
          ))}
        </DropdownItemGroup>
      </DropdownMenu>
      {content}
      {closestEdge && <DropIndicator edge={closestEdge} gap={ROW_GAP} />}
    </li>
  );
};
