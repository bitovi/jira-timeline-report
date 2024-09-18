import { expect, it } from "vitest";

import { getConfidenceDefault } from "./normalize.js";

it("getConfidenceDefault", () => {
  expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
  expect(getConfidenceDefault({ fields: { 'Story points confidence': 10 } })).toBe(10);

  expect(getConfidenceDefault({ fields: { 'Story points confidence': 10, Confidence: 20 } })).toBe(10);
});
