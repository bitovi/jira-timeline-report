import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { AdfDocument } from './AdfDocument';

const paragraph = (text: string, ...marks: unknown[]) => ({
  type: 'paragraph',
  content: [{ type: 'text', text, marks }],
});

const cell = (kind: 'tableHeader' | 'tableCell', text: string) => ({
  type: kind,
  attrs: {},
  content: [paragraph(text)],
});

const doc = (...content: unknown[]) => ({ type: 'doc', version: 1, content });

const table = {
  type: 'table',
  attrs: {},
  content: [
    { type: 'tableRow', content: [cell('tableHeader', 'Env'), cell('tableHeader', 'State')] },
    { type: 'tableRow', content: [cell('tableCell', 'prod'), cell('tableCell', 'green')] },
  ],
};

/**
 * These exercise the real `@atlaskit/renderer` rather than a mock, because the risk worth a test here is
 * it failing to *mount* — prosemirror under jsdom, which is what the observer stubs in
 * `vitest.setup.ts` exist for. Everything downstream (`LatestComment`, `ReportOfReports`) sees the
 * synchronous `Suspense` fallback instead, which keeps those suites fast and deterministic.
 *
 * The generous timeouts are the dynamic `import()` being transformed and loaded on demand — seconds, not
 * the 1s `waitFor` default.
 *
 * **The fallback is deliberately not asserted here.** `React.lazy` caches the module on first load, so
 * only the first test in a file could ever observe a fallback, and a test that passes because of its
 * position in the file is worse than no test. `AdfBlocks.test.tsx` covers the fallback's rendering, and
 * `LatestComment.test.tsx` asserts against it throughout — that suite never loads the real renderer.
 *
 * See spec/016-report-of-reports/007-latest-comment-report § Rich rendering.
 */
describe('AdfDocument', () => {
  it('renders a table, which the local walker cannot', async () => {
    const { container } = render(<AdfDocument document={doc(table)} />);

    await waitFor(() => expect(container.querySelector('table')).not.toBeNull(), { timeout: 20000 });

    expect(container.querySelectorAll('tr')).toHaveLength(2);
    expect(container.querySelectorAll('th')).toHaveLength(2);
    expect(container.querySelectorAll('td')).toHaveLength(2);
    expect(screen.getByText('Env')).toBeInTheDocument();
    expect(screen.getByText('green')).toBeInTheDocument();
  }, 30000);

  it('keeps marks through the real renderer', async () => {
    const { container } = render(
      <AdfDocument document={doc(paragraph('Bold', { type: 'strong' }), paragraph('Under', { type: 'underline' }))} />,
    );

    await waitFor(() => expect(container.querySelector('.ak-renderer-wrapper')).not.toBeNull(), { timeout: 20000 });

    expect(screen.getByText('Bold').tagName).toBe('STRONG');
    expect(screen.getByText('Under').tagName).toBe('U');
  }, 30000);

  it('renders a rule and a nested list through the real renderer', async () => {
    const { container } = render(
      <AdfDocument
        document={doc(
          { type: 'rule' },
          {
            type: 'bulletList',
            content: [{ type: 'listItem', content: [paragraph('BulletText')] }],
          },
        )}
      />,
    );

    await waitFor(() => expect(container.querySelector('hr')).not.toBeNull(), { timeout: 20000 });

    expect(screen.getByText('BulletText').closest('li')).toBeInTheDocument();
  }, 30000);
});
