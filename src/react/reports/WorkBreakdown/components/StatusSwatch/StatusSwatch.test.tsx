import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';
import { StatusSwatch } from './StatusSwatch';

describe('StatusSwatch', () => {
  test('na → blank outline with "no work" label', () => {
    render(<StatusSwatch state="na" />);
    const swatch = screen.getByLabelText('No work of this type');
    expect(swatch.className).toContain('border-neutral-20');
    expect(swatch.className).not.toContain('color-text-and-bg');
  });

  test('nodate → tan unknown swatch with ∅ glyph', () => {
    render(<StatusSwatch state="nodate" />);
    const swatch = screen.getByLabelText('Work exists, no dates');
    expect(swatch.className).toContain('color-text-and-bg-unknown');
    expect(swatch.textContent).toBe('∅');
  });

  test('status → colored swatch with the status color class', () => {
    render(<StatusSwatch state="behind" />);
    const swatch = screen.getByLabelText('Behind');
    expect(swatch.className).toContain('color-text-and-bg-behind');
  });

  test('size prop controls dimensions', () => {
    render(<StatusSwatch state="complete" size="sm" />);
    expect(screen.getByLabelText('Complete').className).toContain('w-3');
  });

  test('title overrides the default tooltip', () => {
    render(<StatusSwatch state="complete" title="Design: Complete" />);
    expect(screen.getByLabelText('Complete').getAttribute('title')).toBe('Design: Complete');
  });
});
