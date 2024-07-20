// sum.test.js
import { expect, test } from 'vitest'
import { getConfidenceDefault } from './normalize.js'

test('getConfidenceDefault', () => {
  expect(getConfidenceDefault({fields: {Confidence: 20}})).toBe(20);
})