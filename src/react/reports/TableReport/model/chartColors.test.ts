import { describe, expect, test } from 'vitest';

import { FAMILY_COLORS, THEME_COLORS, chartColor, colorForName, familyShadeForName } from './chartColors';
import { statusChartColor } from './normalizedRenderers';

// Atlassian's light theme, as shipped: the source of each token's fallback.
import lightTheme from '@atlaskit/tokens/dist/cjs/artifacts/themes/atlassian-light';

/** `color.chart.blue.bold` → its value in Atlassian's light theme stylesheet. */
const themeValue = (id: string) => {
  const variable = `--ds-${id.replace(/^color\./, '').replace(/\./g, '-')}`;
  return new RegExp(`${variable}:\\s*([^;]+);`).exec(lightTheme as unknown as string)?.[1];
};

describe('chart colour palette', () => {
  test("every token's fallback is its Atlassian light-theme value", () => {
    for (const color of FAMILY_COLORS) {
      const fallback = /var\([^,]+,\s*([^)]+)\)/.exec(color.background)?.[1];
      expect({ id: color.id, value: fallback?.toUpperCase() }).toEqual({ id: color.id, value: themeValue(color.id) });
    }
  });

  test('ids are unique and resolvable; unknown ids are not', () => {
    const all = [...THEME_COLORS, ...FAMILY_COLORS];
    expect(new Set(all.map((c) => c.id)).size).toBe(all.length);
    for (const color of all) expect(chartColor(color.id)).toBe(color);
    expect(chartColor('not-a-color')).toBeUndefined();
    expect(chartColor(undefined)).toBeUndefined();
  });

  test('theme colours follow Settings → Theme', () => {
    expect(chartColor('theme.complete')).toMatchObject({
      background: 'var(--complete-color)',
      text: 'var(--complete-text-color)',
    });
  });
});

describe('default colours are picked by name', () => {
  test('the same name always gets the same colour, one from the picker grid', () => {
    expect(colorForName('Ready')).toBe(colorForName('Ready'));
    expect(FAMILY_COLORS.map((c) => c.id)).toContain(colorForName('Ready'));
  });

  test('different names spread across the palette', () => {
    const names = ['Idea', 'Estimating', 'Ready', 'Refined', 'Refinement', 'Done', 'In Progress', 'Blocked', 'QA'];
    expect(new Set(names.map(colorForName)).size).toBeGreaterThan(4);
  });

  test('a family shade is stable per name', () => {
    expect(familyShadeForName('gray', 'Idea')).toMatch(/^color\.chart\.gray\.(bold|bolder|boldest)$/);
    expect(familyShadeForName('gray', 'Idea')).toBe(familyShadeForName('gray', 'Idea'));
  });

  test('statuses in one category share a family but not always a shade', () => {
    const todo = ['Idea', 'Estimating', 'Ready', 'Refined', 'Backlog'].map((s) => statusChartColor(s, 'To Do'));
    for (const id of todo) expect(id).toMatch(/^color\.chart\.gray\./);
    expect(new Set(todo).size).toBeGreaterThan(1);
  });
});
