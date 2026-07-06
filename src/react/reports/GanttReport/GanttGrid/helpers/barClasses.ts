export interface Extends {
  startExtends: boolean;
  endExtends: boolean;
}

/**
 * Tailwind rounding for a timeline bar — clipped edges lose their rounded corner so the bar
 * reads as "continues off-screen".
 *
 * Replaces gantt-grid.js's corner/border helpers.
 */
export const barCornerClass = ({ startExtends, endExtends }: Extends): string =>
  !startExtends && !endExtends
    ? 'rounded'
    : startExtends && endExtends
      ? 'rounded-none'
      : startExtends
        ? 'rounded-r'
        : 'rounded-l';

export const barBorderClasses = ({ startExtends, endExtends }: Extends): string[] =>
  !startExtends && !endExtends
    ? ['border']
    : startExtends && endExtends
      ? ['border-0']
      : startExtends
        ? ['border-r', 'border-y']
        : ['border-l', 'border-y'];
