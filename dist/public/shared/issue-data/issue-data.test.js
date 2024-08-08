// sum.test.js
import { expect, test } from 'vitest';
import { getConfidenceDefault } from './issue-data.js';
test('getConfidenceDefault', function () {
    expect(getConfidenceDefault({ fields: { Confidence: 20 } })).toBe(20);
});
