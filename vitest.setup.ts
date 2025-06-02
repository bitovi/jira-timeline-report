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
