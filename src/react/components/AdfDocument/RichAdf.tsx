import type { FC } from 'react';
import type { DocNode } from '@atlaskit/adf-schema';

import React from 'react';
import { IntlProvider } from 'react-intl';
import { ReactRenderer } from '@atlaskit/renderer';

export interface RichAdfProps {
  document: unknown;
}

/**
 * Jira rich text through Atlassian's own renderer.
 *
 * **Nothing may import this module directly** — go through {@link AdfDocument}, which loads it with
 * `React.lazy`. It is the only module that reaches into `@atlaskit/renderer`, and that is what keeps
 * the editor stack (renderer + `editor-common`, ~2 MB of bundle) in its own chunk instead of in
 * `index`, which every document pays for whether or not it holds a comment.
 *
 * **The `IntlProvider` is load-bearing.** This app has none higher in the tree — `JqlEditor.tsx:24`
 * records the same problem for the JQL editor — and the renderer throws without one rather than
 * degrading. `locale="en"` matches what the JQL editor does.
 *
 * `appearance="comment"` is the renderer's own name for the compact treatment, which is what a comment
 * in a document wants: no full-page gutters, no breakout.
 *
 * **No providers are passed, deliberately.** `mediaProvider` and `mentionProvider` both need auth
 * infrastructure this app has no way to obtain, so inline images and attachments do not load and
 * mentions render without avatars. See the plan's § Rich rendering for what that costs.
 */
export const RichAdf: FC<RichAdfProps> = ({ document }) => (
  <IntlProvider locale="en">
    <ReactRenderer document={document as DocNode} appearance="comment" />
  </IntlProvider>
);

// `React.lazy` wants a default export.
export default RichAdf;
