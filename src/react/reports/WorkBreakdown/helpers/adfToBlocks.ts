/**
 * A structured, renderer-agnostic view of an ADF (Atlassian Document Format) document's blocks.
 * Kept as plain data (not JSX) so it stays trivial to unit test — the actual `<ol>`/`<ul>`/`<p>`
 * rendering lives in `StatusSummaryBody`, wrapped in a Tailwind `prose` container.
 */
export type AdfBlock =
  | { type: 'paragraph'; text: string }
  | { type: 'heading'; level: number; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'codeBlock'; text: string }
  | { type: 'orderedList'; start: number; items: AdfBlock[][] }
  | { type: 'bulletList'; items: AdfBlock[][] };

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
  attrs?: { order?: number; level?: number; [key: string]: unknown };
}

const isNode = (value: unknown): value is AdfNode =>
  typeof value === 'object' && value !== null && ('type' in value || 'content' in value || 'text' in value);

/** Concatenate all descendant `text` runs under `node` (e.g. multiple `text` marks in one line). */
const leafText = (node: AdfNode): string => {
  const acc = { text: '' };
  const walk = (n: AdfNode) => {
    if (n.text) {
      acc.text += n.text;
    }
    for (const child of n.content ?? []) {
      walk(child);
    }
  };
  walk(node);
  return acc.text.trim();
};

const collectListItemBlocks = (item: AdfNode): AdfBlock[] => (item.content ?? []).flatMap(collectBlocks);

function collectBlocks(node: AdfNode): AdfBlock[] {
  if (node.type === 'orderedList' || node.type === 'bulletList') {
    const items = (node.content ?? []).map(collectListItemBlocks);
    return [
      node.type === 'orderedList'
        ? { type: 'orderedList', start: typeof node.attrs?.order === 'number' ? node.attrs.order : 1, items }
        : { type: 'bulletList', items },
    ];
  }

  if (node.type === 'paragraph' || node.type === 'blockquote' || node.type === 'codeBlock') {
    const text = leafText(node);
    return text ? [{ type: node.type, text }] : [];
  }

  if (node.type === 'heading') {
    const text = leafText(node);
    return text ? [{ type: 'heading', level: typeof node.attrs?.level === 'number' ? node.attrs.level : 1, text }] : [];
  }

  // A container node (e.g. `doc`, or an unrecognized wrapper) — recurse into its children.
  return (node.content ?? []).flatMap(collectBlocks);
}

/** Convert a Jira field value (ADF object or plain string) to a list of structured blocks. */
export const adfToBlocks = (value: unknown): AdfBlock[] => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [{ type: 'paragraph', text }] : [];
  }

  if (!isNode(value)) {
    return [];
  }

  return collectBlocks(value);
};
