import { useLayoutEffect, useMemo, useState } from 'react';
import type { MeasureConfig, TextWidthMeasurements } from '../../types';
import { measureTextWidths } from './measureTextWidths';

/**
 * Batched, cached text-width measurement hook.
 *
 * Runs {@link measureTextWidths} in a `useLayoutEffect` (after DOM layout, before paint) and
 * caches the result, re-measuring only when the label set or density changes (Option C in
 * measurement-batching.md). The cache key joins texts with a NUL separator so distinct label
 * lists never collide.
 *
 * Until `isMeasured` is `true`, `widthsByText` is empty; the container should render a
 * skeleton / no markers and treat `rows` as `[]`, mirroring the legacy "visibleWidth not
 * ready" behavior (behavior.md Edge Case #7).
 */
export const useMeasuredTextWidths = (config: MeasureConfig): TextWidthMeasurements => {
  const [widthsByText, setWidthsByText] = useState<Map<string, number>>(new Map());
  const [isMeasured, setIsMeasured] = useState(false);

  const cacheKey = useMemo(
    () => `${config.isLotsOfIssues}|${config.texts.join('\u0000')}`,
    [config.texts, config.isLotsOfIssues],
  );

  useLayoutEffect(() => {
    setWidthsByText(measureTextWidths(config));
    setIsMeasured(true);
    // Re-run only when the stable cache key changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  return { widthsByText, isMeasured };
};
