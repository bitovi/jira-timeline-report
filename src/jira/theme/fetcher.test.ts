import type { AppStorage } from '../storage/common';

import { describe, expect, it, vi } from 'vitest';

import { defaultTheme, getTheme, updateTheme } from './fetcher';

const storageStub = (overrides: Partial<AppStorage> = {}): AppStorage =>
  ({
    get: async () => null,
    update: async () => {},
    storageInitialized: async () => true,
    ...overrides,
  }) as AppStorage;

describe('getTheme', () => {
  it('returns the defaults when nothing has been saved', async () => {
    await expect(getTheme(storageStub())).resolves.toEqual(defaultTheme);
  });

  it('merges saved colors in by label', async () => {
    const saved = [{ label: 'Complete', backgroundColor: '#123456' }];

    const theme = await getTheme(storageStub({ get: async () => saved as any }));

    expect(theme.find(({ label }) => label === 'Complete')?.backgroundColor).toBe('#123456');
    expect(theme.find(({ label }) => label === 'Blocked')?.backgroundColor).toBe(
      defaultTheme.find(({ label }) => label === 'Blocked')?.backgroundColor,
    );
  });

  it('fills in an entry the stored theme predates', async () => {
    // A theme saved before the Section entry existed: eight status colors, no Section row.
    const saved = defaultTheme
      .filter(({ group }) => group === 'status')
      .map(({ label, backgroundColor }) => ({ label, backgroundColor }));

    const theme = await getTheme(storageStub({ get: async () => saved as any }));

    const section = theme.find(({ label }) => label === 'Section');

    expect(section).toBeDefined();
    expect(section?.backgroundColor).toBe('#FBFCFC');
    expect(section?.group).toBe('reportOfReports');
    expect(section?.backgroundCssVar).toBe('--section-color');
  });

  it('re-derives css vars and group from the defaults rather than from storage', async () => {
    // Storage only ever holds {label, backgroundColor}; a stale/hostile extra key must not win.
    const saved = [{ label: 'Complete', backgroundColor: '#123456', backgroundCssVar: '--nope', group: 'status' }];

    const theme = await getTheme(storageStub({ get: async () => saved as any }));

    expect(theme.find(({ label }) => label === 'Complete')?.backgroundCssVar).toBe('--complete-color');
  });
});

describe('updateTheme', () => {
  it('persists only label and backgroundColor', async () => {
    const update = vi.fn(async () => {});

    await updateTheme(storageStub({ update: update as any }), defaultTheme);

    const [key, value] = update.mock.calls[0] as unknown as [string, Array<Record<string, unknown>>];

    expect(key).toBe('theme');
    expect(value).toHaveLength(defaultTheme.length);
    expect(Object.keys(value[0]).sort()).toEqual(['backgroundColor', 'label']);
  });
});
