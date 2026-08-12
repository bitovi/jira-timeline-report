/**
 * A structured, renderer-agnostic view of an ADF (Atlassian Document Format) document's blocks.
 * Kept as plain data (not JSX) so it stays trivial to unit test — the actual `<ol>`/`<ul>`/`<p>`
 * rendering lives in {@link AdfBlocks}, wrapped in a Tailwind `prose` container by its caller.
 *
 * Block content is a list of **inline runs** rather than one flattened string, because the marks Jira
 * puts on text — bold, italic, underline, links — are the difference between a comment that reads the
 * way its author wrote it and one that doesn't. Hard breaks (Shift+Enter in Jira) are runs too: they
 * carry no text, so flattening dropped them silently and turned two lines into one.
 */

/** The marks this understands. Anything else Jira can apply (colour, sub/superscript) is ignored. */
export interface AdfMarks {
  strong?: boolean;
  em?: boolean;
  underline?: boolean;
  strike?: boolean;
  code?: boolean;
  /** An `http`/`https`/`mailto` href. Any other scheme is dropped — see {@link safeHref}. */
  href?: string;
}

/** One run of inline content: text with its marks, or a hard line break. */
export type AdfInline = ({ type: 'text'; text: string } & AdfMarks) | { type: 'break' };

export type AdfBlock =
  | { type: 'paragraph'; content: AdfInline[] }
  | { type: 'heading'; level: number; content: AdfInline[] }
  | { type: 'blockquote'; content: AdfInline[] }
  // A code block's content is plain text by definition — marks don't apply inside one.
  | { type: 'codeBlock'; text: string }
  | { type: 'orderedList'; start: number; items: AdfBlock[][] }
  | { type: 'bulletList'; items: AdfBlock[][] };

interface AdfMarkNode {
  type?: string;
  attrs?: { href?: string; [key: string]: unknown };
}

interface AdfNode {
  type?: string;
  text?: string;
  content?: AdfNode[];
  marks?: AdfMarkNode[];
  attrs?: { order?: number; level?: number; [key: string]: unknown };
}

const isNode = (value: unknown): value is AdfNode =>
  typeof value === 'object' && value !== null && ('type' in value || 'content' in value || 'text' in value);

/**
 * Only schemes that can't execute script. A link's href comes from Jira content, and it lands in an
 * `<a href>`, so `javascript:` and `data:` are dropped rather than rendered — the run keeps its text and
 * loses only its link.
 */
const safeHref = (href: unknown): string | undefined => {
  if (typeof href !== 'string') {
    return undefined;
  }

  const scheme = /^\s*([a-z][a-z0-9+.-]*):/i.exec(href)?.[1]?.toLowerCase();

  // No scheme at all is a relative URL, which can't execute.
  if (!scheme) {
    return href;
  }

  return scheme === 'http' || scheme === 'https' || scheme === 'mailto' ? href : undefined;
};

const marksOf = (marks: AdfMarkNode[] | undefined): AdfMarks => {
  const applied: AdfMarks = {};

  for (const mark of marks ?? []) {
    switch (mark.type) {
      case 'strong':
        applied.strong = true;
        break;
      case 'em':
        applied.em = true;
        break;
      case 'underline':
        applied.underline = true;
        break;
      case 'strike':
        applied.strike = true;
        break;
      case 'code':
        applied.code = true;
        break;
      case 'link': {
        const href = safeHref(mark.attrs?.href);

        if (href) {
          applied.href = href;
        }
        break;
      }
      default:
        // textColor, backgroundColor, subsup, and anything Jira adds later: the text still renders.
        break;
    }
  }

  return applied;
};

/** Block-level nodes that mean "a line ended" when flattened into one run of inline content. */
const BLOCK_ISH = new Set(['paragraph', 'heading', 'blockquote', 'listItem']);

/**
 * All inline content under `node`, in order.
 *
 * Flattening is deliberate for the containers that use it: a blockquote holding two paragraphs becomes
 * one blockquote with a break between them, which is what it looks like in Jira.
 */
const inlineContent = (node: AdfNode): AdfInline[] => {
  const runs: AdfInline[] = [];

  const walk = (current: AdfNode, isRoot: boolean) => {
    if (typeof current.text === 'string') {
      runs.push({ type: 'text', text: current.text, ...marksOf(current.marks) });

      return;
    }

    if (current.type === 'hardBreak') {
      runs.push({ type: 'break' });

      return;
    }

    // A nested block boundary reads as a line ending. The root itself isn't a boundary — it *is* the
    // block — so it doesn't get a leading break.
    if (!isRoot && BLOCK_ISH.has(current.type ?? '') && runs.length) {
      runs.push({ type: 'break' });
    }

    for (const child of current.content ?? []) {
      walk(child, false);
    }
  };

  walk(node, true);

  return normalize(runs);
};

/**
 * Trims the way the old flattening did — leading and trailing whitespace goes, and content that is only
 * whitespace becomes nothing so the caller can drop the block.
 */
const normalize = (runs: AdfInline[]): AdfInline[] => {
  const trimmed = [...runs];

  while (trimmed.length && isBlank(trimmed[0])) {
    trimmed.shift();
  }

  while (trimmed.length && isBlank(trimmed[trimmed.length - 1])) {
    trimmed.pop();
  }

  if (!trimmed.length) {
    return [];
  }

  const first = trimmed[0];
  const last = trimmed[trimmed.length - 1];

  if (first.type === 'text') {
    trimmed[0] = { ...first, text: first.text.replace(/^\s+/, '') };
  }

  if (last.type === 'text') {
    trimmed[trimmed.length - 1] = { ...last, text: last.text.replace(/\s+$/, '') };
  }

  return trimmed.filter((run) => run.type !== 'text' || run.text !== '');
};

const isBlank = (run: AdfInline): boolean => run.type === 'break' || run.text.trim() === '';

/** All descendant text under `node`, for the containers that hold plain text (code blocks). */
const leafText = (node: AdfNode): string => {
  let text = '';

  const walk = (current: AdfNode) => {
    if (current.text) {
      text += current.text;
    }
    for (const child of current.content ?? []) {
      walk(child);
    }
  };

  walk(node);

  return text.trim();
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

  if (node.type === 'codeBlock') {
    const text = leafText(node);
    return text ? [{ type: 'codeBlock', text }] : [];
  }

  if (node.type === 'paragraph' || node.type === 'blockquote') {
    const content = inlineContent(node);
    return content.length ? [{ type: node.type, content }] : [];
  }

  if (node.type === 'heading') {
    const content = inlineContent(node);
    return content.length
      ? [{ type: 'heading', level: typeof node.attrs?.level === 'number' ? node.attrs.level : 1, content }]
      : [];
  }

  // A container node (e.g. `doc`, or an unrecognized wrapper) — recurse into its children.
  return (node.content ?? []).flatMap(collectBlocks);
}

/** Convert a Jira field value (ADF object or plain string) to a list of structured blocks. */
export const adfToBlocks = (value: unknown): AdfBlock[] => {
  if (typeof value === 'string') {
    const text = value.trim();
    return text ? [{ type: 'paragraph', content: [{ type: 'text', text }] }] : [];
  }

  if (!isNode(value)) {
    return [];
  }

  return collectBlocks(value);
};

/** The plain text of a block's inline content — for labels, titles, and anywhere marks can't render. */
export const inlineToText = (content: AdfInline[]): string =>
  content.map((run) => (run.type === 'break' ? '\n' : run.text)).join('');
