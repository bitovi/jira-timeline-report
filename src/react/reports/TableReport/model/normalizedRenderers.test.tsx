import { describe, expect, test } from 'vitest';

import { chartColor } from './chartColors';
import { statusRender } from './normalizedRenderers';

import type { ReactElement } from 'react';
import type { RenderContext } from './columns';

const ctx = (extra: Partial<RenderContext> = {}) =>
  ({ issue: { statusCategory: 'To Do' }, depth: 0, ...extra }) as RenderContext;

// jsdom drops inline `var(--ds-…)` colours, so these read the Lozenge's props rather than the DOM.
describe('statusRender', () => {
  test("keeps Jira's category appearance when no colour is picked", () => {
    const lozenge = statusRender('Ready', ctx()) as ReactElement;
    expect(lozenge.props).toMatchObject({ appearance: 'default', style: undefined });
  });

  test('takes the colour picked in Order and colors', () => {
    const purple = chartColor('color.chart.purple.boldest')!;
    const lozenge = statusRender('Ready', ctx({ valueColors: { Ready: purple.id } })) as ReactElement;
    expect(lozenge.props.style).toEqual({ backgroundColor: purple.background, color: purple.text });
  });

  test('ignores colours picked for other values, and unknown colour ids', () => {
    expect(
      (statusRender('Ready', ctx({ valueColors: { Done: 'color.chart.red.bold' } })) as ReactElement).props.style,
    ).toBeUndefined();
    expect(
      (statusRender('Ready', ctx({ valueColors: { Ready: 'nope' } })) as ReactElement).props.style,
    ).toBeUndefined();
  });
});
