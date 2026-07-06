import type { Density } from '../types';

/**
 * Derive the density tier from the number of cards — ports the legacy `columnDensity`
 * thresholds (`> 20` absurd, `> 10` high, `> 4` medium, else light).
 */
export const density = (cardCount: number): Density => {
  if (cardCount > 20) return 'absurd';
  if (cardCount > 10) return 'high';
  if (cardCount > 4) return 'medium';
  return 'light';
};

/**
 * Font-size class for a child list of `count` items at a given density tier — ports the legacy
 * `fontSize`. Returns `''` (inherit) for the mid-size default case.
 */
export const fontSizeClass = (tier: Density, count: number): string => {
  if (tier === 'high' || tier === 'absurd') return 'text-xs';
  if (count >= 7 && tier === 'medium') return 'text-sm';
  if (count <= 4) return 'text-base';
  return '';
};
