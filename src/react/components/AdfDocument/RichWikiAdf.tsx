import type { FC } from 'react';

import React from 'react';
import { WikiMarkupTransformer } from '@atlaskit/editor-wikimarkup-transformer';
import { JSONTransformer } from '@atlaskit/editor-json-transformer';
import { defaultSchema } from '@atlaskit/adf-schema/schema-default';

import { AdfDocument } from './AdfDocument';

export interface RichWikiAdfProps {
  /** Wiki markup, straight from Jira — e.g. a "Paragraph"-type custom field's raw value. */
  markup: string;
  fallbackClassName?: string;
}

const jsonTransformer = new JSONTransformer();

/**
 * Wiki markup (`h1. heading`, `* bullet`, `||col||`-style tables) — Jira's legacy rich-text storage
 * format, still used by some custom fields (e.g. "Status Update", `customfield_10844`) even though
 * `description` and comments moved to ADF. There is no renderer for wiki markup itself; instead it's
 * converted to ADF with the same parser Atlassian uses internally, then handed to `AdfDocument` — the
 * wiki case reuses the ADF renderer, it just has a conversion step in front.
 *
 * **Nothing may import this module directly** — go through {@link WikiAdfDocument}, which loads it with
 * `React.lazy`. The conversion pulls in the same heavy editor stack `RichAdf` already lazy-loads
 * (`@atlaskit/editor-wikimarkup-transformer` plus its ADF-schema/prosemirror peers), so it must live
 * behind the same lazy boundary rather than in the main chunk.
 *
 * See spec/030-inline-custom-field-report § Wiki markup → ADF.
 */
export const RichWikiAdf: FC<RichWikiAdfProps> = ({ markup, fallbackClassName }) => {
  const document = React.useMemo(() => {
    try {
      const pmNode = new WikiMarkupTransformer(defaultSchema).parse(markup);

      return jsonTransformer.encode(pmNode);
    } catch {
      // Real Jira wiki markup is machine-generated and well-formed, but a hand-edited or unusual
      // value could still trip the parser. That's one field failing to render, not the whole report:
      // catch it here rather than let it throw during render and reach the page-wide error boundary.
      return null;
    }
  }, [markup]);

  if (document === null) {
    return <p className="text-sm text-slate-500">This field's content couldn't be rendered.</p>;
  }

  return <AdfDocument document={document} fallbackClassName={fallbackClassName} />;
};

// `React.lazy` wants a default export.
export default RichWikiAdf;
