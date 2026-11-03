/**
 * The "Stacked bar" aggregation's cell (spec/044-planning-health-mvp): one segment per value, sized
 * by its share of the group and showing its count, drawn like the Estimation Progress report's bars.
 * With `onShowIssues` a segment is a button that lists its issues in a modal.
 *
 * Generic over any text/select column. Colours: see {@link segmentColor}. Segments follow the
 * column's value order (`valueOrder.ts`). Array values (e.g. Labels) are flattened, as Count by value
 * does.
 */
import { createElement } from 'react';
import Tooltip from '@atlaskit/tooltip';

import { issuesByValue, orderValues } from './valueOrder';
import { chartColor, colorForName } from './chartColors';

import type { MouseEvent, ReactNode } from 'react';
import type { TriggerProps } from '@atlaskit/tooltip';
import type { ChartColor } from './chartColors';
import type { ColumnDefinition, RenderMeasureContext, TableIssue } from './columns';

/** Width of the bar; each segment takes its share of the group. */
const STACKED_BAR_WIDTH = 200;

/**
 * A value's segment colour: the colour picked for it (⋯ → Order and colors), else the column's
 * default for it (Status by category, Estimate Progress by planning state), else one picked by its
 * name. Unknown ids (a hand-edited URL) fall through to the next.
 */
export function segmentColor(
  column: ColumnDefinition,
  value: string,
  sample: TableIssue,
  valueColors: Readonly<Record<string, string>> = {},
): ChartColor {
  return (
    chartColor(valueColors[value]) ??
    chartColor(column.bar?.defaultColor?.(value, sample)) ??
    chartColor(colorForName(value))!
  );
}

export function renderStackedBar(column: ColumnDefinition, ctx: RenderMeasureContext): ReactNode {
  const byValue = issuesByValue(column, ctx.members);
  const total = [...byValue.values()].reduce((sum, issues) => sum + issues.length, 0);
  if (total === 0) return '';

  const values = orderValues(byValue.keys(), ctx.valueOrder);

  const segments = values.map((value) => {
    const issues = byValue.get(value)!;
    const text = `${value} (${issues.length})`;
    const color = segmentColor(column, value, issues[0], ctx.valueColors);
    const count = createElement('span', { className: 'pr-1' }, issues.length);
    // Atlaskit's Tooltip in its render-function form: it hands its handlers and ref to the segment
    // itself, with no wrapper element to break the segment's percentage width inside the flex bar.
    const segment = (tooltip: TriggerProps) => {
      const props = {
        ...tooltip,
        'aria-label': text,
        'data-testid': 'stacked-bar-segment',
        'data-color': color.id,
        className: 'inline-block text-right',
        style: { width: `${(issues.length * 100) / total}%`, backgroundColor: color.background, color: color.text },
      };
      return ctx.onShowIssues
        ? createElement(
            'button',
            {
              ...props,
              type: 'button',
              className: `${props.className} cursor-pointer hover:text-blue-400`,
              onClick: (event: MouseEvent<HTMLElement>) => {
                tooltip.onClick(event);
                ctx.onShowIssues!(text, issues);
              },
            },
            count,
          )
        : createElement('div', { ...props, role: 'img' }, count);
    };
    return createElement(Tooltip, { key: value, content: text, children: segment });
  });

  return createElement(
    'div',
    { className: 'flex', 'data-testid': 'stacked-bar', style: { width: STACKED_BAR_WIDTH } },
    segments,
  );
}
