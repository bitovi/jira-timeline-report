// sum.test.js
import { expect, test } from 'vitest'
import { getConfidenceDefault } from './issue-data.js'

test('getConfidenceDefault', () => {
  expect(getConfidenceDefault({fields: {Confidence: 20}})).toBe(20);
})