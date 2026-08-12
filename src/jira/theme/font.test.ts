import type { AppStorage } from '../storage/common';

import { describe, expect, it, beforeEach, vi } from 'vitest';

import {
  applyFontToCssVars,
  customFontStack,
  defaultFont,
  FONT_LINK_ID,
  FONT_PRESETS,
  getFont,
  isAllowedFontUrl,
  sanitizeFontFamily,
} from './font';

const storageStub = (overrides: Partial<AppStorage> = {}): AppStorage =>
  ({
    get: async () => null,
    update: async () => {},
    storageInitialized: async () => true,
    ...overrides,
  }) as AppStorage;

describe('isAllowedFontUrl', () => {
  it('accepts https urls', () => {
    expect(isAllowedFontUrl('https://fonts.googleapis.com/css2?family=Inter')).toBe(true);
    expect(isAllowedFontUrl('https://fonts.example.co.uk/brand.css')).toBe(true);
  });

  it('rejects plaintext http', () => {
    expect(isAllowedFontUrl('http://fonts.googleapis.com/css2?family=Inter')).toBe(false);
  });

  it('rejects script and data urls', () => {
    expect(isAllowedFontUrl('javascript:alert(1)')).toBe(false);
    expect(isAllowedFontUrl('data:text/css;base64,Ym9keXtjb2xvcjpyZWR9')).toBe(false);
  });

  it('rejects malformed input', () => {
    expect(isAllowedFontUrl('')).toBe(false);
    expect(isAllowedFontUrl('not a url')).toBe(false);
    expect(isAllowedFontUrl('//fonts.googleapis.com/css2')).toBe(false);
  });
});

describe('sanitizeFontFamily', () => {
  it('keeps ordinary family names intact', () => {
    expect(sanitizeFontFamily('Inter')).toBe('Inter');
    expect(sanitizeFontFamily('Helvetica Neue')).toBe('Helvetica Neue');
    expect(sanitizeFontFamily('IBM Plex Sans')).toBe('IBM Plex Sans');
  });

  it('strips quotes, semicolons, and braces so a name cannot escape the declaration', () => {
    const sanitized = sanitizeFontFamily(`Inter'; background: url(https://evil.test)`);

    expect(sanitized).toBe('Inter background urlhttpseviltest');
    expect(sanitized).not.toMatch(/['";:()/]/);
  });

  it('drops characters that would break out of a css value', () => {
    const sanitized = sanitizeFontFamily(`a'"{};:/\\<>()`);

    expect(sanitized).toBe('a');
  });
});

describe('customFontStack', () => {
  it('quotes the sanitized family and appends a generic fallback', () => {
    expect(customFontStack('Inter')).toBe(`'Inter', sans-serif`);
  });

  it('falls back to the default when nothing usable survives sanitizing', () => {
    expect(customFontStack('{};')).toBe(defaultFont.stack);
    expect(customFontStack('   ')).toBe(defaultFont.stack);
  });
});

describe('applyFontToCssVars', () => {
  beforeEach(() => {
    document.getElementById(FONT_LINK_ID)?.remove();
    document.documentElement.style.removeProperty('--report-font-sans');
  });

  it('sets --report-font-sans from the stack', () => {
    applyFontToCssVars({ stack: `'Poppins', sans-serif` });

    expect(document.documentElement.style.getPropertyValue('--report-font-sans')).toBe(`'Poppins', sans-serif`);
  });

  it('falls back to the default font when given nothing', () => {
    applyFontToCssVars(undefined);

    expect(document.documentElement.style.getPropertyValue('--report-font-sans')).toBe(defaultFont.stack);
  });

  it('adds a stylesheet link for a custom font', () => {
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/inter.css' });

    const link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement | null;

    expect(link).not.toBeNull();
    expect(link?.getAttribute('rel')).toBe('stylesheet');
    expect(link?.getAttribute('href')).toBe('https://fonts.example.test/inter.css');
  });

  it('removes the link when switching back to a preset', () => {
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/inter.css' });
    expect(document.getElementById(FONT_LINK_ID)).not.toBeNull();

    applyFontToCssVars({ stack: FONT_PRESETS[0].stack });

    expect(document.getElementById(FONT_LINK_ID)).toBeNull();
  });

  it('never injects a link for a disallowed url', () => {
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'http://fonts.example.test/inter.css' });

    expect(document.getElementById(FONT_LINK_ID)).toBeNull();
    // The stack still applies — only the stylesheet is refused.
    expect(document.documentElement.style.getPropertyValue('--report-font-sans')).toBe(`'Inter', sans-serif`);
  });

  it('reuses the existing link rather than stacking up duplicates', () => {
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/a.css' });
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/b.css' });

    expect(document.querySelectorAll(`#${FONT_LINK_ID}`)).toHaveLength(1);
    expect(document.getElementById(FONT_LINK_ID)?.getAttribute('href')).toBe('https://fonts.example.test/b.css');
  });

  it('does not reassign href when the url is unchanged, so a debounced re-apply does not refetch', () => {
    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/a.css' });

    const link = document.getElementById(FONT_LINK_ID) as HTMLLinkElement;
    const setAttribute = vi.spyOn(link, 'setAttribute');

    applyFontToCssVars({ stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/a.css' });

    expect(setAttribute).not.toHaveBeenCalled();
  });
});

describe('getFont', () => {
  it('returns the default when nothing has been saved', async () => {
    await expect(getFont(storageStub())).resolves.toEqual(defaultFont);
  });

  it('returns the saved font', async () => {
    const saved = { stack: `'Inter', sans-serif`, url: 'https://fonts.example.test/inter.css' };

    await expect(getFont(storageStub({ get: async () => saved as any }))).resolves.toEqual(saved);
  });

  it('falls back to the default for a malformed stored value', async () => {
    await expect(getFont(storageStub({ get: async () => ({ nope: true }) as any }))).resolves.toEqual(defaultFont);
    await expect(getFont(storageStub({ get: async () => ({ stack: '' }) as any }))).resolves.toEqual(defaultFont);
  });
});
