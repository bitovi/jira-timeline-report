import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect } from 'vitest';

import { WikiAdfDocument } from './WikiAdfDocument';

/**
 * Exercises the real `@atlaskit/editor-wikimarkup-transformer` + `@atlaskit/renderer`, not a mock, for
 * the same reason `AdfDocument.test.tsx` does: the risk worth a test here is the conversion or the
 * renderer failing to *mount* under jsdom.
 *
 * The generous timeout is the dynamic `import()` being transformed and loaded on demand.
 *
 * See spec/030-inline-custom-field-report § Wiki markup → ADF.
 */
describe('WikiAdfDocument', () => {
  it('renders wiki markup as a heading, bullet list, and table — the shapes formatFieldValue used to refuse', async () => {
    const markup =
      'h1. Status\n\n* Shipped the migration\n* Rolled back the old endpoint\n\n||Env||State||\n|prod|green|\n';

    const { container } = render(<WikiAdfDocument markup={markup} />);

    await waitFor(() => expect(container.querySelector('table')).not.toBeNull(), { timeout: 20000 });

    expect(container.querySelector('h1')).toHaveTextContent('Status');
    expect(screen.getByText('Shipped the migration').closest('li')).toBeInTheDocument();
    expect(screen.getByText('Rolled back the old endpoint').closest('li')).toBeInTheDocument();
    expect(screen.getByText('Env')).toBeInTheDocument();
    expect(screen.getByText('green')).toBeInTheDocument();
  }, 30000);

  // The loading-note fallback is deliberately not asserted here, for the same reason
  // `AdfDocument.test.tsx` doesn't assert its own fallback: `React.lazy` caches the module on first
  // load, so only the first test in a file could ever observe it, and a test that passes because of its
  // position in the file is worse than no test.

  // The parse-failure fallback is covered in RichWikiAdf.test.tsx, with a mocked transformer: the real
  // one turned out too lenient to reliably fail on hand-crafted malformed input, and a test coupled to
  // exactly which markup currently trips it would be more fragile than the behavior it's protecting.
});
