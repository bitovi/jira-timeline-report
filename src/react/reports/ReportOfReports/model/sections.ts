import { v4 as uuidv4 } from 'uuid';

/**
 * The report-of-reports document tree — the `sections` field on the `Report` record.
 *
 * See spec/016-report-of-reports.
 */

/** ---- stored form: exactly what lands in Jira ---------------------------------------------- */

export type StoredNode =
  | { type: 'saved-report'; params: { reportId: string } }
  | { type: 'section'; params: { title: string }; children: StoredNode[] }
  | { type: 'inline-report'; params: { expression: string } };
// Still anticipated: `text` nodes, and grid options on a section's `params`.

/** ---- in-memory form: the stored form plus identity ---------------------------------------- */

export type SavedReportNode = { id: string; type: 'saved-report'; params: { reportId: string } };

export type SectionNode = { id: string; type: 'section'; params: { title: string }; children: LayoutNode[] };

/**
 * One live Jira field value, written as an expression the user types — `(issue = ABC-1).summary`. The
 * source text is what's stored; it's split into its JQL and field halves on every render rather than
 * at rest, so a saved document stays readable and re-editable.
 * See spec/016-report-of-reports/003-self-reports.
 */
export type InlineReportNode = { id: string; type: 'inline-report'; params: { expression: string } };

/**
 * A node this client can't interpret — an unrecognized `type` (a document written by a newer
 * client) or a structurally malformed one. It renders as a placeholder instead of blanking the
 * page, and `raw` keeps the original so {@link toStoredSections} writes it back untouched.
 */
export type UnknownNode = { id: string; type: 'unknown'; params: { originalType: string; raw: unknown } };

export type LayoutNode = SavedReportNode | SectionNode | InlineReportNode | UnknownNode;

/** Position of a node in the tree: indices from the root, descending through `children`. */
export type LayoutPath = number[];

/**
 * Node identity. In-memory only — it exists so a node keeps its React instance across a reorder
 * (without it, a moved child report re-mounts and refetches from Jira). Nothing persists it, so the
 * stored document stays readable. When a cross-session anchor is needed (a comment on a section, a
 * deep link to one), persist it then: the parser already accepts nodes with or without an `id`.
 */
const nextId = (): string => uuidv4();

export const savedReportNode = (reportId: string): SavedReportNode => ({
  id: nextId(),
  type: 'saved-report',
  params: { reportId },
});

export const sectionNode = (title: string, children: LayoutNode[] = []): SectionNode => ({
  id: nextId(),
  type: 'section',
  params: { title },
  children,
});

export const inlineReportNode = (expression: string): InlineReportNode => ({
  id: nextId(),
  type: 'inline-report',
  params: { expression },
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const placeholder = (raw: unknown): UnknownNode => ({
  id: nextId(),
  type: 'unknown',
  params: {
    originalType: isRecord(raw) && typeof raw.type === 'string' ? raw.type : '',
    raw,
  },
});

const parseNode = (raw: unknown): LayoutNode => {
  if (!isRecord(raw) || typeof raw.type !== 'string') {
    return placeholder(raw);
  }

  if (raw.type === 'saved-report') {
    const reportId = isRecord(raw.params) ? raw.params.reportId : undefined;

    return typeof reportId === 'string' && reportId ? savedReportNode(reportId) : placeholder(raw);
  }

  if (raw.type === 'section') {
    const title = isRecord(raw.params) ? raw.params.title : undefined;

    return sectionNode(typeof title === 'string' ? title : '', parseSections(raw.children));
  }

  if (raw.type === 'inline-report') {
    const expression = isRecord(raw.params) ? raw.params.expression : undefined;

    // A missing expression is tolerated as blank, like a section's title: the node renders its own
    // "write an expression" state rather than becoming an unreadable placeholder.
    return inlineReportNode(typeof expression === 'string' ? expression : '');
  }

  return placeholder(raw);
};

/**
 * Tolerant reader for a stored document. Never throws: a non-array becomes an empty tree, and any
 * node this client can't interpret becomes an {@link UnknownNode} placeholder rather than taking
 * the page down with it.
 */
export const parseSections = (raw: unknown): LayoutNode[] => (Array.isArray(raw) ? raw.map(parseNode) : []);

/**
 * The inverse of {@link parseSections}: drops in-memory ids and restores unrecognized nodes from
 * their original value, so a parse/serialize round trip is lossless even for content written by a
 * newer client.
 */
export const toStoredSections = (nodes: LayoutNode[]): StoredNode[] =>
  nodes.map((node) => {
    if (node.type === 'unknown') {
      return node.params.raw as StoredNode;
    }

    if (node.type === 'section') {
      return { type: 'section', params: { title: node.params.title }, children: toStoredSections(node.children) };
    }

    if (node.type === 'inline-report') {
      return { type: 'inline-report', params: { expression: node.params.expression } };
    }

    return { type: 'saved-report', params: { reportId: node.params.reportId } };
  });

/**
 * Whether two trees would store identically — ids excluded. Drives the dirty flag, so a layout edit
 * surfaces "Save report" and a save clears it.
 */
export const sameSections = (left: LayoutNode[], right: LayoutNode[]): boolean =>
  JSON.stringify(toStoredSections(left)) === JSON.stringify(toStoredSections(right));

const childrenOf = (node: LayoutNode): LayoutNode[] | undefined =>
  node.type === 'section' ? node.children : undefined;

const withChildren = (node: LayoutNode, children: LayoutNode[]): LayoutNode =>
  node.type === 'section' ? { ...node, children } : node;

/**
 * Rebuilds the tree with `replace` applied to the node at `path`. Returns the same reference when
 * the path doesn't resolve, or when `replace` hands back the node it was given — so callers get the
 * "nothing changed" signal for free.
 */
const mapNodeAt = (nodes: LayoutNode[], path: LayoutPath, replace: (node: LayoutNode) => LayoutNode): LayoutNode[] => {
  if (path.length === 0) {
    return nodes;
  }

  const [index, ...rest] = path;
  const target = nodes[index];

  if (!target) {
    return nodes;
  }

  if (rest.length === 0) {
    const updated = replace(target);

    return updated === target ? nodes : nodes.map((existing, at) => (at === index ? updated : existing));
  }

  const children = childrenOf(target);

  if (children === undefined) {
    return nodes;
  }

  const updatedChildren = mapNodeAt(children, rest, replace);

  return updatedChildren === children
    ? nodes
    : nodes.map((existing, at) => (at === index ? withChildren(target, updatedChildren) : existing));
};

/**
 * Appends `node` to the container at `path` (the root when `path` is empty), returning a new tree.
 * A path that doesn't resolve to a container returns the tree unchanged.
 */
export const appendNode = (nodes: LayoutNode[], node: LayoutNode, path: LayoutPath = []): LayoutNode[] => {
  if (path.length === 0) {
    return [...nodes, node];
  }

  const [index, ...rest] = path;
  const target = nodes[index];

  if (!target || childrenOf(target) === undefined) {
    return nodes;
  }

  const updated = withChildren(target, appendNode(childrenOf(target) ?? [], node, rest));

  return updated === target ? nodes : nodes.map((existing, at) => (at === index ? updated : existing));
};

/**
 * Retitles the section at `path`, returning a new tree.
 *
 * The node keeps its `id` and its `children` array, so a retitle never remounts the section or
 * anything inside it — a remounted child report refetches from Jira. Returns the tree unchanged
 * (same reference) when the path misses, points at something other than a section, or the title is
 * already what it would be set to; that last case is what keeps a no-op inline-edit confirm from
 * flipping the dirty flag.
 */
export const setSectionTitleAt = (nodes: LayoutNode[], path: LayoutPath, title: string): LayoutNode[] =>
  mapNodeAt(nodes, path, (node) =>
    node.type === 'section' && node.params.title !== title ? { ...node, params: { ...node.params, title } } : node,
  );

/**
 * Rewrites the expression of the inline-value node at `path`, returning a new tree. Same contract as
 * {@link setSectionTitleAt}: the node keeps its `id`, and an unresolvable path, a node of another
 * type, or an unchanged expression all return the very same tree.
 */
export const setExpressionAt = (nodes: LayoutNode[], path: LayoutPath, expression: string): LayoutNode[] =>
  mapNodeAt(nodes, path, (node) =>
    node.type === 'inline-report' && node.params.expression !== expression
      ? { ...node, params: { ...node.params, expression } }
      : node,
  );

/**
 * Removes the node at `path`, returning a new tree. A path that doesn't resolve — out of range, or
 * descending into a node that has no children — returns the tree unchanged.
 */
export const removeNodeAt = (nodes: LayoutNode[], path: LayoutPath): LayoutNode[] => {
  if (path.length === 0) {
    return nodes;
  }

  const [index, ...rest] = path;
  const target = nodes[index];

  if (!target) {
    return nodes;
  }

  if (rest.length === 0) {
    return nodes.filter((_node, at) => at !== index);
  }

  const children = childrenOf(target);

  if (children === undefined) {
    return nodes;
  }

  const updatedChildren = removeNodeAt(children, rest);

  return updatedChildren === children
    ? nodes
    : nodes.map((existing, at) => (at === index ? withChildren(target, updatedChildren) : existing));
};

/** The list holding the node at `path`, plus that node's index in it. `undefined` if `path` misses. */
const locate = (nodes: LayoutNode[], path: LayoutPath): { siblings: LayoutNode[]; index: number } | undefined => {
  if (path.length === 0) {
    return undefined;
  }

  const [index, ...rest] = path;
  const target = nodes[index];

  if (!target) {
    return undefined;
  }

  if (rest.length === 0) {
    return { siblings: nodes, index };
  }

  const children = childrenOf(target);

  return children === undefined ? undefined : locate(children, rest);
};

/**
 * How deeply sections may nest. The document root is not a level of its own: a top-level section is
 * level 1, and a level-3 section still accepts reports — it just can't hold another section.
 */
export const MAX_SECTION_DEPTH = 3;

/**
 * Whether a section can be added to the container at `path` — the same value {@link appendNode}
 * takes, with `[]` meaning the document root. Backs the "Add Section" affordance, which is hidden
 * rather than disabled once the cap is reached.
 *
 * `path.length` *is* the container's section depth, because only sections have children.
 *
 * This caps creation, not reading: a document nested deeper (hand-edited, or written by a client
 * with a higher cap) still parses and saves back intact — it just can't be nested further here.
 * Adding a *report* needs no equivalent guard; reports are allowed at every level.
 */
export const canAddSectionAt = (nodes: LayoutNode[], path: LayoutPath): boolean => {
  if (path.length >= MAX_SECTION_DEPTH) {
    return false;
  }

  if (path.length === 0) {
    return true;
  }

  const found = locate(nodes, path);

  return found !== undefined && found.siblings[found.index].type === 'section';
};

/**
 * Whether the node at `path` can move `offset` places among its siblings. Backs the disabled state
 * of the move controls, and gates {@link moveNodeAt} so the two can't disagree.
 */
export const canMoveNodeAt = (nodes: LayoutNode[], path: LayoutPath, offset: number): boolean => {
  const found = locate(nodes, path);

  if (!found) {
    return false;
  }

  const destination = found.index + offset;

  return destination >= 0 && destination < found.siblings.length;
};

const swap = (nodes: LayoutNode[], from: number, to: number): LayoutNode[] =>
  nodes.map((node, at) => (at === from ? nodes[to] : at === to ? nodes[from] : node));

/**
 * Moves the node at `path` `offset` places **within its own container** — a section's child never
 * escapes into the parent, since that isn't what an up/down control means. Returns the tree
 * unchanged (same reference) when the move isn't possible.
 */
export const moveNodeAt = (nodes: LayoutNode[], path: LayoutPath, offset: number): LayoutNode[] => {
  if (!canMoveNodeAt(nodes, path, offset)) {
    return nodes;
  }

  const [index, ...rest] = path;

  if (rest.length === 0) {
    return swap(nodes, index, index + offset);
  }

  const target = nodes[index];

  return nodes.map((existing, at) =>
    at === index ? withChildren(target, moveNodeAt(childrenOf(target) ?? [], rest, offset)) : existing,
  );
};

/** Walks the tree depth-first, calling `visit` with each node and its path. */
export const visitNodes = (
  nodes: LayoutNode[],
  visit: (node: LayoutNode, path: LayoutPath) => void,
  parentPath: LayoutPath = [],
): void => {
  nodes.forEach((node, index) => {
    const path = [...parentPath, index];

    visit(node, path);

    const children = childrenOf(node);

    if (children) {
      visitNodes(children, visit, path);
    }
  });
};

/** React key for a node's position. Prefer `node.id`, which survives a reorder. */
export const pathKey = (path: LayoutPath): string => path.join('.');
