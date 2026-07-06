/**
 * Decide whether to apply "lots of issues" density optimizations (smaller text, markers,
 * rows). Ports the legacy runtime behavior exactly: `length > 20` (the legacy
 * `!this.breakdown` term was always true, so it is omitted).
 */
export const shouldUseDensityOptimizations = (issueCount: number): boolean => issueCount > 20;
