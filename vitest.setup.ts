import '@testing-library/jest-dom';
import { vi } from 'vitest';

window.matchMedia = vi.fn().mockImplementation((query) => ({
  matches: vi.fn(),
  media: query,
  onchange: null,
  addListener: vi.fn(), // Deprecated
  removeListener: vi.fn(), // Deprecated
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
}));

global.AP = {};

global.URL.createObjectURL = vi.fn();

/**
 * jsdom implements neither observer API. `@atlaskit/renderer` reaches for `IntersectionObserver`
 * through `@atlaskit/width-detector` during layout effects, so without this every render of it throws
 * — and a table's column widths need `ResizeObserver` for the same reason.
 *
 * Inert stubs, deliberately: they never fire a callback, so nothing observes anything and no test can
 * come to depend on a measurement jsdom has no layout to produce. Anything that genuinely needs a
 * width belongs in Storybook, which is a real browser.
 * See spec/016-report-of-reports/007-latest-comment-report § Rich rendering.
 */
class InertObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
  takeRecords() {
    return [];
  }
}

global.IntersectionObserver = InertObserver as unknown as typeof IntersectionObserver;
global.ResizeObserver = InertObserver as unknown as typeof ResizeObserver;
