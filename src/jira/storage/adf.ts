/**
 * The slice of Atlassian Document Format this app writes into issue descriptions.
 *
 * Two storage backends put JSON in a description: the web build's single configuration issue
 * (`index.web.ts`) and the Reports Space backend, which gives every saved report its own work item
 * (`jira/reports/backend/space.ts`). They agree on the shape — one ```json code block — so the
 * builder and the reader live here rather than in either of them.
 *
 * See spec/026-storage-saved-reports/plan.md § Description ADF.
 */

export interface Mark {
  type: 'strong';
}

export interface TextContent {
  type: 'text';
  text: string;
  marks?: Mark[];
}

export interface Paragraph {
  type: 'paragraph';
  content?: Array<TextContent>;
}

export interface CodeBlock {
  type: 'codeBlock';
  attrs: { language: string };
  content: Array<{ type: 'text'; text: string }>;
}

export const createCodeBlock = (using?: string): CodeBlock => {
  return {
    type: 'codeBlock',
    attrs: { language: 'json' },
    content: [{ type: 'text', text: using ?? `{}` }],
  };
};

export const createParagraph = (text: string): Paragraph => {
  return {
    type: 'paragraph',
    content: [{ type: 'text', text }],
  };
};

/**
 * The text of the first ```json code block anywhere in a description, or null.
 *
 * Recursive rather than a scan of the top-level `content` array (which is all `index.web.ts` needs
 * for the issue it writes itself): a Reports Space work item is an ordinary issue a user can edit,
 * and dragging the block into a panel or a list item must not read as "this report has no data".
 */
export const findCodeBlockText = (document: unknown): string | null => {
  if (Array.isArray(document)) {
    for (const item of document) {
      const found = findCodeBlockText(item);

      if (found !== null) {
        return found;
      }
    }

    return null;
  }

  if (!document || typeof document !== 'object') {
    return null;
  }

  const node = document as Partial<CodeBlock> & Record<string, unknown>;

  if (node.type === 'codeBlock') {
    const text = node.content?.map((fragment) => fragment?.text ?? '').join('') ?? '';

    return text;
  }

  return findCodeBlockText(node.content);
};
