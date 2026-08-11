import { v4 as uuidv4 } from 'uuid';

/**
 * The report-of-reports document tree — the `sections` field on the `Report` record.
 *
 * See spec/016-report-of-reports.
 */

/** ---- stored form: exactly what lands in Jira ---------------------------------------------- */

export type StoredNode =
  | { type: 'saved-report'; params: SavedReportParams }
  | { type: 'section'; params: { title: string }; children: StoredNode[] }
  | { type: 'inline-value'; params: { expression: string } }
  | { type: 'inline-report'; params: { query: string } };
// Still anticipated: `text` nodes, and grid options on a section's `params`.

/**
 * `overrides` is how a change made *inside* an embedded report is kept: a `URLSearchParams`-shaped
 * fragment of only the keys that differ from that report's own saved `queryParams`, so a child's
 * effective configuration is `merge(report.queryParams, overrides)` — a string both
 * `ChildReportConfig` and `parseChildQuery` already know how to read.
 *
 * It rides on the node rather than being keyed by one, which is what lets it travel through a
 * reorder or a delete, survive `toStoredSections`/`parseSections`, and persist on "Save report"
 * with no change to the save path — and is why node ids can stay in-memory-only.
 * See spec/016-report-of-reports/006-url-state Phase 2.
 */
type SavedReportParams = { reportId: string; overrides?: string };

/** ---- in-memory form: the stored form plus identity ---------------------------------------- */

/**
 * The stored object a node was parsed from, when there was one.
 *
 * Kept so that keys this client doesn't understand survive a round trip instead of being dropped
 * the next time the document is saved. The {@link UnknownNode} placeholder already does this for an
 * unrecognized `type`; this does it for extra keys on a type we *do* recognize — grid options on a
 * section's `params` are the next thing planned for this schema, and without this an older client
 * that merely opened and saved a document would silently erase them.
 *
 * Absent on a node this client just created, which has nothing extra to preserve.
 */
type WithRaw = { raw?: Record<string, unknown> };

export type SavedReportNode = { id: string; type: 'saved-report'; params: SavedReportParams } & WithRaw;

export type SectionNode = {
  id: string;
  type: 'section';
  params: { title: string };
  children: LayoutNode[];
} & WithRaw;

/**
 * One live Jira field value, written as an expression the user types — `(issue = ABC-1).summary`. The
 * source text is what's stored; it's split into its JQL and field halves on every render rather than
 * at rest, so a saved document stays readable and re-editable.
 * See spec/016-report-of-reports/003-self-reports.
 */
export type InlineValueNode = { id: string; type: 'inline-value'; params: { expression: string } } & WithRaw;

/**
 * A whole report that lives *in* the document rather than referring out to a saved one — the
 * unsaved counterpart of a {@link SavedReportNode}, and rendered by the same `ChildReport`.
 *
 * Its configuration is stored as one `URLSearchParams`-shaped query string rather than a nested
 * object, deliberately: it is exactly the shape `ChildReportConfig`, `parseChildQuery` and
 * `mergeChildQuery` already read, so nothing downstream needs a second encoding — and a node's
 * config can be pasted to and from a page URL.
 *
 * **No `overrides` key.** That mechanism exists because a saved-report child has a saved baseline to
 * diff against, so a setting returned to its original value clears itself. An inline report *is* its
 * own baseline, so an edit writes straight into `params.query` — see {@link setInlineReportParam}.
 *
 * Created by the secondary-slot migration, which turns one legacy config carrying both a chart and a
 * card board into a document with one of these per report. See spec/018-card-report/alt-plan.md.
 */
export type InlineReportNode = { id: string; type: 'inline-report'; params: { query: string } } & WithRaw;

/**
 * A node this client can't interpret — an unrecognized `type` (a document written by a newer
 * client) or a structurally malformed one. It renders as a placeholder instead of blanking the
 * page, and `raw` keeps the original so {@link toStoredSections} writes it back untouched.
 */
export type UnknownNode = { id: string; type: 'unknown'; params: { originalType: string; raw: unknown } };

export type LayoutNode = SavedReportNode | SectionNode | InlineValueNode | InlineReportNode | UnknownNode;

/** Position of a node in the tree: indices from the root, descending through `children`. */
export type LayoutPath = number[];

/**
 * Node identity. In-memory only — it exists so a node keeps its React instance across a reorder
 * (without it, a moved child report re-mounts and refetches from Jira). Nothing persists it, so the
 * stored document stays readable. When a cross-session anchor is needed (a comment on a section, a
 * deep link to one), persist it then: the parser already accepts nodes with or without an `id`.
 */
const nextId = (): string => uuidv4();

export const savedReportNode = (reportId: string, overrides?: string): SavedReportNode => ({
  id: nextId(),
  type: 'saved-report',
  params: overrides ? { reportId, overrides } : { reportId },
});

export const sectionNode = (title: string, children: LayoutNode[] = []): SectionNode => ({
  id: nextId(),
  type: 'section',
  params: { title },
  children,
});

export const inlineValueNode = (expression: string): InlineValueNode => ({
  id: nextId(),
  type: 'inline-value',
  params: { expression },
});

export const inlineReportNode = (query: string): InlineReportNode => ({
  id: nextId(),
  type: 'inline-report',
  params: { query },
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
    const overrides = isRecord(raw.params) ? raw.params.overrides : undefined;

    return typeof reportId === 'string' && reportId
      ? { ...savedReportNode(reportId, typeof overrides === 'string' ? overrides : undefined), raw }
      : placeholder(raw);
  }

  if (raw.type === 'section') {
    const title = isRecord(raw.params) ? raw.params.title : undefined;

    return { ...sectionNode(typeof title === 'string' ? title : '', parseSections(raw.children)), raw };
  }

  if (raw.type === 'inline-value') {
    const expression = isRecord(raw.params) ? raw.params.expression : undefined;

    // A missing expression is tolerated as blank, like a section's title: the node renders its own
    // "write an expression" state rather than becoming an unreadable placeholder.
    return { ...inlineValueNode(typeof expression === 'string' ? expression : ''), raw };
  }

  if (raw.type === 'inline-report') {
    const query = isRecord(raw.params) ? raw.params.query : undefined;

    // A missing query is tolerated as blank rather than becoming a placeholder: an empty query is a
    // renderable report (the default one, over no JQL), and turning it into "Unsupported content"
    // would be a harsher failure than the config deserves.
    return { ...inlineReportNode(typeof query === 'string' ? query : ''), raw };
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
 * The keys this client owns on a node's `params`, layered back over whatever the document was
 * stored with. Spreading the original first means keys we don't understand come along and the ones
 * we do keep their original position, so a stored document serializes back byte-identical — which
 * is what {@link sameSections} compares.
 */
const storedParams = (node: WithRaw, params: Record<string, unknown>): Record<string, unknown> => {
  const original = isRecord(node.raw?.params) ? node.raw.params : undefined;

  return original ? { ...original, ...params } : params;
};

/**
 * The inverse of {@link parseSections}: drops in-memory ids and restores anything this client
 * didn't interpret — an unrecognized node from its original value, and unrecognized keys on a
 * recognized node from its {@link WithRaw} — so a parse/serialize round trip is lossless even for a
 * document written by a newer client.
 *
 * The casts are because a preserved node carries keys `StoredNode` doesn't name; that is the point.
 */
export const toStoredSections = (nodes: LayoutNode[]): StoredNode[] =>
  nodes.map((node) => {
    if (node.type === 'unknown') {
      return node.params.raw as StoredNode;
    }

    if (node.type === 'section') {
      return {
        ...node.raw,
        type: 'section',
        params: storedParams(node, { title: node.params.title }),
        children: toStoredSections(node.children),
      } as StoredNode;
    }

    if (node.type === 'inline-value') {
      return {
        ...node.raw,
        type: 'inline-value',
        params: storedParams(node, { expression: node.params.expression }),
      } as StoredNode;
    }

    // Needs its own branch for the same reason every type above does — the fall-through below is the
    // saved-report case, so an unhandled node would serialize as
    // `{ type: 'saved-report', params: { reportId: undefined } }` and be destroyed on the first save.
    // `WithRaw` does not rescue that: it preserves unrecognized *keys on a recognized type*, and a
    // node this client just created (which is every node the migration makes) has no `raw` at all.
    if (node.type === 'inline-report') {
      return {
        ...node.raw,
        type: 'inline-report',
        params: storedParams(node, { query: node.params.query }),
      } as StoredNode;
    }

    const params = storedParams(node, { reportId: node.params.reportId });

    // The one key that can be *removed* rather than merely rewritten — an override drops off when
    // its value returns to the child's saved one. Spreading the original back over it would
    // otherwise resurrect the old fragment.
    if (node.params.overrides) {
      params.overrides = node.params.overrides;
    } else {
      delete params.overrides;
    }

    return { ...node.raw, type: 'saved-report', params } as StoredNode;
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
 * Same as {@link mapNodeAt} but keyed by node identity, so the caller doesn't have to hold a path.
 * Used by the override path, where the callback is handed to a memoized `ChildReport`: an id is a
 * string and keeps that memo intact, while a path is a fresh array on every render and would defeat
 * it — and a document re-renders on every hover.
 */
const mapNodeById = (nodes: LayoutNode[], id: string, replace: (node: LayoutNode) => LayoutNode): LayoutNode[] => {
  let changed = false;

  const next = nodes.map((node) => {
    if (node.id === id) {
      const updated = replace(node);

      changed = changed || updated !== node;

      return updated;
    }

    const children = childrenOf(node);

    if (children === undefined) {
      return node;
    }

    const updatedChildren = mapNodeById(children, id, replace);

    if (updatedChildren === children) {
      return node;
    }

    changed = true;

    return withChildren(node, updatedChildren);
  });

  return changed ? next : nodes;
};

/**
 * Records — or clears, when `value` is `undefined` — one configuration override on an embedded
 * report's node, returning a new tree.
 *
 * The node keeps its `id`, so recording an override never remounts the child that just made it; a
 * remounted child refetches from Jira. Same "nothing changed" contract as {@link setSectionTitleAt}:
 * an unknown id, a node of another type, and a write that leaves the fragment as it was all return
 * the very same tree — which is what keeps a report re-announcing its current value from flipping
 * the dirty flag.
 *
 * See spec/016-report-of-reports/006-url-state Phase 2.
 */
export const setNodeOverride = (
  nodes: LayoutNode[],
  nodeId: string,
  key: string,
  value: string | undefined,
): LayoutNode[] =>
  mapNodeById(nodes, nodeId, (node) => {
    if (node.type !== 'saved-report') {
      return node;
    }

    const overrides = new URLSearchParams(node.params.overrides ?? '');

    if (value === undefined) {
      if (!overrides.has(key)) {
        return node;
      }

      overrides.delete(key);
    } else {
      if (overrides.get(key) === value) {
        return node;
      }

      overrides.set(key, value);
    }

    const params: SavedReportParams = { ...node.params };
    const fragment = overrides.toString();

    if (fragment) {
      params.overrides = fragment;
    } else {
      delete params.overrides;
    }

    return { ...node, params };
  });

/**
 * Records one setting an inline report just wrote — or removes it, when `value` is `undefined` — by
 * rewriting that key in the node's own `query`.
 *
 * The inline-report counterpart of {@link setNodeOverride}, and deliberately not the same function:
 * an override is a *diff against a saved report*, and an inline report has no saved report to diff
 * against. Its query IS its configuration, so an edit is written straight into it. (This is also why
 * `setNodeOverride` returns anything that isn't a `saved-report` untouched, and must keep doing so —
 * an inline report routed through it would silently grow an `overrides` key nothing reads.)
 *
 * Same contracts as {@link setNodeOverride} otherwise: keyed by node id so the memoized `ChildReport`
 * that calls it isn't rebuilt per render, the node keeps its `id` so recording a change never
 * remounts the child that made it (a remounted child refetches from Jira), and a write that leaves
 * the query as it was returns the very same tree — which is what keeps a report re-announcing its
 * current value from flipping the dirty flag.
 */
export const setInlineReportParam = (
  nodes: LayoutNode[],
  nodeId: string,
  key: string,
  value: string | undefined,
): LayoutNode[] =>
  mapNodeById(nodes, nodeId, (node) => {
    if (node.type !== 'inline-report') {
      return node;
    }

    const query = new URLSearchParams(node.params.query);

    if (value === undefined) {
      if (!query.has(key)) {
        return node;
      }

      query.delete(key);
    } else {
      if (query.get(key) === value) {
        return node;
      }

      query.set(key, value);
    }

    return { ...node, params: { ...node.params, query: query.toString() } };
  });

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
 * The title of the section a node would be added into, for naming the destination in the Add Report
 * modal — the same `path` {@link appendNode} takes.
 *
 * `undefined` means "nothing to name": the document root (`[]`), a path that misses, or a container
 * that isn't a section. An **untitled** section is `''`, which is a different answer — the caller can
 * then say "this section" rather than pretending the add is going nowhere in particular.
 *
 * See spec/016-report-of-reports/009-value-report-modal.
 */
export const sectionTitleAt = (nodes: LayoutNode[], path: LayoutPath): string | undefined => {
  const found = locate(nodes, path);

  if (!found) {
    return undefined;
  }

  const node = found.siblings[found.index];

  return node.type === 'section' ? node.params.title : undefined;
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
