import type { FC } from 'react';

import React, { Suspense } from 'react';

import { AdfBlocks, adfToBlocks } from '../AdfBlocks';

export interface AdfDocumentProps {
  /** A raw ADF document, straight from Jira. */
  document: unknown;
  /** Classes for the fallback's wrapper. The real renderer brings its own typography. */
  fallbackClassName?: string;
}

/**
 * Jira rich text, rendered the way Jira renders it.
 *
 * Two renderers, one seam:
 *
 * - **`@atlaskit/renderer`**, loaded on demand — tables, panels, code blocks, emoji, status lozenges,
 *   dates, and smart links, none of which the local walker produces.
 * - **{@link AdfBlocks}**, the local walker, as the `Suspense` fallback — paragraphs, headings, lists,
 *   quotes, marks, and hard breaks, rendered instantly from a module that is already in the main chunk.
 *
 * The fallback is the point of the split. The editor stack is a large chunk to fetch, and a comment is
 * usually a sentence: showing the walker's version immediately and letting the real renderer replace it
 * beats an empty box or a spinner, and a reader of a plain-prose comment may never see a difference.
 * It also means the walker is live production code rather than something kept warm by its tests.
 *
 * **What still doesn't render, with either:** inline images and attachments (needs a `mediaProvider` and
 * a media token this app can't obtain) and mention avatars (needs a `mentionProvider`). Mention *names*
 * do render, through the real renderer only.
 *
 * See spec/016-report-of-reports/007-latest-comment-report § Rich rendering.
 */
const RichAdf = React.lazy(() => import('./RichAdf'));

export const AdfDocument: FC<AdfDocumentProps> = ({ document, fallbackClassName }) => (
  <Suspense fallback={<AdfBlocks blocks={adfToBlocks(document)} className={fallbackClassName} />}>
    <RichAdf document={document} />
  </Suspense>
);

export default AdfDocument;
