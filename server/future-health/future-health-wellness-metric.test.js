import { describe, expect, test } from 'vitest';
import futureHealthWellnessMetric from './future-health-wellness-metric.js';

function fakeResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
  return res;
}

describe('POST /future-health-wellness-metric/:issueKey', () => {
  test('returns 400 for malformed input', () => {
    const res = fakeResponse();

    futureHealthWellnessMetric({ params: {}, body: {} }, res);

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toEqual([
      { message: 'issueKey path param is required' },
      { message: 'issues must be an array' },
      { message: 'model must be an object' },
    ]);
  });
});
