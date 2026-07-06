import type { PositionConfig, IssuePosition } from '../types';

/**
 * Compute left/right percentages for an issue on the timeline grid.
 *
 * The issue is anchored by its right edge at the (rounded) due date. `overflowsLeft` is
 * true when the label would extend past the left boundary — the component uses it to flip
 * the label to the right of the marker so it stays in view. Measurement is a parameter
 * (`textWidth`), keeping this pure.
 */
export const calculatePositionPercentages = (config: PositionConfig): IssuePosition => {
  const { roundedDueDate, textWidth, widthOfArea, firstDay, lastDay } = config;

  const totalTime = lastDay.getTime() - firstDay.getTime();
  const dueOffset = roundedDueDate.getTime() - firstDay.getTime();

  const widthInPercent = (textWidth * 100) / widthOfArea;
  const rightPercentEnd = (dueOffset / totalTime) * 100;
  const endPercentFromRight = ((totalTime - dueOffset) / totalTime) * 100;
  const leftPercentStart = rightPercentEnd - widthInPercent;

  return {
    leftPercentStart,
    rightPercentEnd,
    endPercentFromRight,
    widthInPercent,
    overflowsLeft: leftPercentStart < 0,
  };
};
