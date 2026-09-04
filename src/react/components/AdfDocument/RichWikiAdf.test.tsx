import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { RichWikiAdf } from './RichWikiAdf';

vi.mock('@atlaskit/editor-wikimarkup-transformer', () => ({
  WikiMarkupTransformer: class {
    parse() {
      throw new Error('boom');
    }
  },
}));

/**
 * The real transformer is lenient enough that hand-crafted "malformed" wiki markup doesn't reliably
 * make it throw (see WikiAdfDocument.test.tsx), so the parser is mocked here to force the failure this
 * component exists to contain.
 *
 * See spec/030-inline-custom-field-report § Wiki markup → ADF.
 */
describe('RichWikiAdf', () => {
  it('renders an inline message instead of throwing when the markup fails to parse', () => {
    render(<RichWikiAdf markup="h1. anything" />);

    expect(screen.getByText(/couldn't be rendered/)).toBeInTheDocument();
  });
});
