import type { FC, MouseEvent, ReactNode } from 'react';
import type { LayoutNode, LayoutPath } from '../model/sections';

import React, { createContext, useContext, useMemo, useState } from 'react';

export interface DocumentEditingContextValue {
  /**
   * The node whose field is open for editing, by node id — a section's title or an inline value's
   * expression. Only ever one at a time, which is what keeps two open editors from both claiming
   * focus.
   */
  editingNodeId: string | null;
  beginEditing: (id: string) => void;
  endEditing: () => void;
  /**
   * The container the report picker is adding into, or `null` when it's closed. A path, not a
   * boolean, because "Add Report" now appears in every section and the picker has to know which one
   * it was opened from. **`[]` is a valid value** — the document root — so the open check is
   * `!== null`, never plain truthiness.
   */
  pickerPath: LayoutPath | null;
  openReportPicker: (path: LayoutPath) => void;
  closeReportPicker: () => void;
  /**
   * Whether the node at `path` is the one under the pointer. Exactly one node at a time — the
   * innermost, so pointing at a report inside a section lights up that report's row and nothing
   * above it.
   *
   * It covers "a report's controls appear while the pointer is anywhere in that node, its chart
   * included" without being a prefix test: a chart isn't a node of its own, so pointing at one
   * resolves to the report that owns it. See {@link useNodeRow}.
   */
  isHovered: (path: LayoutPath) => boolean;
  /**
   * Whether the container at `path` is the innermost one the pointer is inside — `[]` for the
   * document root. Backs each section's add row, which is an affordance of the container rather than
   * of a node: pointing at a report inside a section counts as pointing into that section, but *not*
   * into the sections above it, so only one add row is ever revealed.
   */
  isContainerHovered: (path: LayoutPath) => boolean;
  /**
   * Records the innermost node under the pointer, and with it the container that node sits in: its
   * own path when it's a section (a section's row and gutter are inside it), otherwise its parent's.
   * `null` clears both. See {@link useNodeRow}.
   */
  hoverNode: (path: LayoutPath | null, isContainer?: boolean) => void;
  /**
   * Sections (and reports) the user has collapsed. By node id rather than path: collapsing a node and
   * then reordering its siblings would otherwise collapse whichever node landed in its place.
   *
   * Deliberately not persisted — the stored document is unchanged by this redesign, so a reload
   * opens everything expanded.
   */
  isCollapsed: (id: string) => boolean;
  toggleCollapsed: (id: string) => void;
}

const DocumentEditingContext = createContext<DocumentEditingContextValue | null>(null);

/**
 * Transient editing state for one report-of-reports document: which node is open for editing, where
 * the report picker would add, and the pointer/collapse state the row list needs (hover, collapse).
 * None of it is part of the document, so it never reaches `ReportLayoutProvider` (which holds the tree
 * itself) and nothing here is saved.
 *
 * It's a context rather than props for the reason `NodeControls` documents: the document renders
 * recursively, and this state has to be reachable at any depth without threading callbacks through
 * every level. `ReportOfReports` mounts the provider itself, so no caller or test has to.
 * See spec/016-report-of-reports/002-nested-sections and .../004-redesign.
 */
export const useDocumentEditing = (): DocumentEditingContextValue => {
  const context = useContext(DocumentEditingContext);

  if (!context) {
    throw new Error('Cannot use useDocumentEditing outside of its provider');
  }

  return context;
};

/** Whether two paths name the same node. */
const samePath = (left: LayoutPath | null, right: LayoutPath | null): boolean =>
  left === right ||
  (left !== null && right !== null && left.length === right.length && left.every((index, at) => right[at] === index));

/** The innermost node under the pointer, and the container it sits in. */
interface Hover {
  path: LayoutPath;
  container: LayoutPath;
}

export const DocumentEditingProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);
  const [pickerPath, setPickerPath] = useState<LayoutPath | null>(null);
  const [hovered, setHovered] = useState<Hover | null>(null);
  const [collapsedIds, setCollapsedIds] = useState<ReadonlySet<string>>(() => new Set());

  const value = useMemo<DocumentEditingContextValue>(
    () => ({
      editingNodeId,
      beginEditing: (id) => setEditingNodeId(id),
      endEditing: () => setEditingNodeId(null),
      pickerPath,
      openReportPicker: (path) => setPickerPath(path),
      closeReportPicker: () => setPickerPath(null),
      isHovered: (path) => hovered !== null && samePath(hovered.path, path),
      isContainerHovered: (path) => hovered !== null && samePath(hovered.container, path),
      hoverNode: (path, isContainer = false) =>
        setHovered((current) => {
          if (path === null) {
            return null;
          }

          // `mouseover` fires for every element the pointer crosses, and a chart is thousands of
          // them. Handing back the identical state keeps React from re-rendering the document per SVG
          // bar; the paths are rebuilt on each render, so reference equality can't do this.
          if (samePath(current?.path ?? null, path)) {
            return current;
          }

          // A section's own row and indent gutter count as inside it. Everything else — a report, a
          // value, a chart — puts the pointer in whatever container holds it.
          return { path, container: isContainer ? path : path.slice(0, -1) };
        }),
      isCollapsed: (id) => collapsedIds.has(id),
      toggleCollapsed: (id) =>
        setCollapsedIds((current) => {
          const next = new Set(current);

          if (!next.delete(id)) {
            next.add(id);
          }

          return next;
        }),
    }),
    [editingNodeId, pickerPath, hovered, collapsedIds],
  );

  return <DocumentEditingContext.Provider value={value}>{children}</DocumentEditingContext.Provider>;
};

/**
 * Everything one node's wrapper and its row need from the context, so each branch of the recursive
 * renderer is three lines rather than six.
 *
 * Hover is React state driven by `onMouseOver` rather than a CSS `:hover` rule: nesting is what breaks
 * the CSS version, since `group-hover` reveals a control on every ancestor the pointer is inside
 * rather than on the one node it's actually on. (jsdom never evaluates `:hover` either, so a CSS-only
 * reveal would leave every control permanently `pointer-events: none` under test.)
 *
 * `stopPropagation` is what makes the *innermost* node win: `mouseover` bubbles outward, so the first
 * wrapper to see it is the deepest one, and it takes the event away from its ancestors. That's what
 * keeps exactly one row lit at a time however deeply the document nests.
 */
export const useNodeRow = (
  node: LayoutNode,
  path: LayoutPath,
): {
  hoverProps: { onMouseOver: (event: MouseEvent) => void };
  rowProps: { nodeId: string; isHovered: boolean; onClick: () => void };
} => {
  const { isHovered, hoverNode, toggleCollapsed } = useDocumentEditing();

  return {
    hoverProps: {
      onMouseOver: (event) => {
        event.stopPropagation();
        // Only a section is a container, and it's the node type that decides — which is why this
        // takes the node rather than just its path and id.
        hoverNode(path, node.type === 'section');
      },
    },
    rowProps: {
      nodeId: node.id,
      isHovered: isHovered(path),
      // Clicking anywhere on the row toggles collapse — `NodeRow` stops a click on `controls`/`caret`
      // from bubbling here, so this only fires for the rest of the row (including the title, now that
      // `SectionTitle` no longer makes the title itself a click-to-edit trigger). A no-op for a node
      // type with nothing to collapse (a value, an unknown node): `toggleCollapsed` just records an id
      // nothing ever reads back.
      onClick: () => toggleCollapsed(node.id),
    },
  };
};
