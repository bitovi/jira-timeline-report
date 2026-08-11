import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import FontPicker from './FontPicker';
import { defaultFont, FONT_PRESETS } from '../../../../../../jira/theme';

describe('FontPicker', () => {
  it('renders the current preset', () => {
    render(<FontPicker font={defaultFont} onChange={vi.fn()} />);

    expect(screen.getByText('System default')).toBeInTheDocument();
  });

  it('shows the custom fields when the saved font has a url', () => {
    render(
      <FontPicker
        font={{ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/inter.css' }}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Stylesheet URL')).toHaveValue('https://fonts.example.test/inter.css');
    // The family name is recovered from the stored stack so the field isn't blank on reopen.
    expect(screen.getByLabelText('Font family name')).toHaveValue('Inter');
  });

  it('does not emit while the custom url is incomplete', () => {
    const onChange = vi.fn();

    render(<FontPicker font={{ stack: 'x', url: 'https://a.test/f.css' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Stylesheet URL'), { target: { value: 'https:/' } });

    expect(onChange).not.toHaveBeenCalled();
  });

  it('flags a non-https url and still refuses to emit it', () => {
    const onChange = vi.fn();

    render(<FontPicker font={{ stack: 'x', url: 'https://a.test/f.css' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Stylesheet URL'), { target: { value: 'http://evil.test/f.css' } });

    expect(screen.getByText('Must be an https:// URL.')).toBeInTheDocument();
    expect(onChange).not.toHaveBeenCalled();
  });

  it('emits once both a valid url and a family are present', () => {
    const onChange = vi.fn();

    render(<FontPicker font={{ stack: 'x', url: 'https://a.test/f.css' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Font family name'), { target: { value: 'Inter' } });

    expect(onChange).toHaveBeenCalledWith({ stack: `'Inter', sans-serif`, url: 'https://a.test/f.css' });
  });

  it('sanitizes a family name that tries to break out of the css declaration', () => {
    const onChange = vi.fn();

    render(<FontPicker font={{ stack: 'x', url: 'https://a.test/f.css' }} onChange={onChange} />);

    fireEvent.change(screen.getByLabelText('Font family name'), {
      target: { value: `Inter'; background: url(https://evil.test)` },
    });

    const [emitted] = onChange.mock.calls.at(-1) as [{ stack: string }];

    expect(emitted.stack).toBe(`'Inter background urlhttpseviltest', sans-serif`);
    // Nothing that could terminate the declaration survives — only the quotes we added ourselves.
    expect(emitted.stack).not.toMatch(/[;(){}:]/);
  });

  it('emits a bare stack when a preset is chosen, dropping any custom url', () => {
    const onChange = vi.fn();

    render(<FontPicker font={defaultFont} onChange={onChange} />);

    // react-select renders a combobox; picking an option through the DOM needs the menu opened.
    fireEvent.keyDown(screen.getByRole('combobox'), { key: 'ArrowDown' });
    fireEvent.click(screen.getByText(FONT_PRESETS[1].label));

    expect(onChange).toHaveBeenCalledWith({ stack: FONT_PRESETS[1].stack });
  });
});
