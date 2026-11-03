import { describe, expect, test } from 'vitest';

import { classifyEstimateProgress, isEstimated } from './estimationProgress';

describe('isEstimated', () => {
  test('needs an estimate and a confidence', () => {
    expect(isEstimated({ storyPoints: 5, storyPointsMedian: null, confidence: 80 })).toBe(true);
    expect(isEstimated({ storyPoints: null, storyPointsMedian: 3, confidence: 80 })).toBe(true);
    expect(isEstimated({ storyPoints: 5, storyPointsMedian: null, confidence: null })).toBe(false);
    expect(isEstimated({ storyPoints: null, storyPointsMedian: null, confidence: 80 })).toBe(false);
  });

  test('zero is an estimate', () => {
    expect(isEstimated({ storyPoints: 0, storyPointsMedian: null, confidence: 0 })).toBe(true);
  });
});

describe('classifyEstimateProgress', () => {
  test('maps child counts to the four labels', () => {
    expect(classifyEstimateProgress(0, 0)).toBe('No children');
    expect(classifyEstimateProgress(3, 3)).toBe('Estimated');
    expect(classifyEstimateProgress(3, 0)).toBe('Unestimated');
    expect(classifyEstimateProgress(3, 1)).toBe('Partially estimated');
  });
});
