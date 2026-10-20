import '@testing-library/jest-dom';
import { afterAll, vi } from 'vitest';

/**
 * Reading an unbound CanJS computed (e.g. `routeData.roundTo`, pulled in by
 * `roundDateByRoundToParam`) temporarily binds it and schedules the unbind with
 * `setTimeout(..., 10)` (can-observation/temporarily-bind.js). If a file's last such read lands
 * within 10ms of its end, that unbind fires after Vitest tears down the jsdom `window`, and
 * can-dom-events throws `ReferenceError: window is not defined` as an unhandled error that fails
 * the run even though every test passed. Waiting longer than that timer here, before teardown,
 * lets it fire while `window` still exists — Node runs timers in deadline order, so any pending
 * 10ms unbind always fires before this one resolves.
 */
const CANJS_TEMPORARY_UNBIND_MS = 10;

afterAll(async () => {
  await new Promise((resolve) => setTimeout(resolve, CANJS_TEMPORARY_UNBIND_MS + 5));
});

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
