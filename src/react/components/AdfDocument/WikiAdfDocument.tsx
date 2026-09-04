import type { FC } from 'react';

import React, { Suspense } from 'react';

export interface WikiAdfDocumentProps {
  /** Wiki markup, straight from Jira. */
  markup: string;
  /** Classes for the fallback's wrapper, forwarded to the real renderer's own local-walker fallback. */
  fallbackClassName?: string;
}

const RichWikiAdf = React.lazy(() => import('./RichWikiAdf'));

/**
 * Wiki markup, rendered the way Jira renders it — the wiki-markup sibling of {@link AdfDocument}, for
 * fields still storing rich text in Atlassian's legacy syntax (`h1. heading`, `* bullet`, `||col||`
 * tables) instead of ADF.
 *
 * Unlike ADF, wiki markup has no cheap local-walker equivalent to fall back to instantly — parsing it
 * needs the same editor stack the real renderer does. So, unlike `AdfDocument`, the `Suspense` fallback
 * here is just a brief loading note rather than an immediate rendering of the content; the wait is the
 * one dynamic `import()`, not a network round trip, so it is short.
 *
 * See spec/030-inline-custom-field-report § Wiki markup → ADF.
 */
export const WikiAdfDocument: FC<WikiAdfDocumentProps> = ({ markup, fallbackClassName }) => (
  <Suspense fallback={<p className="text-sm text-slate-500">Loading…</p>}>
    <RichWikiAdf markup={markup} fallbackClassName={fallbackClassName} />
  </Suspense>
);

export default WikiAdfDocument;
