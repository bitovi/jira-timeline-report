import { describe, test, expect } from 'vitest';
import tagToDates from './tag-to-dates.js';

/** Minimal stand-in for an Express response, so the handler needs no HTTP server. */
function fakeResponse() {
  const res = {
    statusCode: null,
    body: null,
    status(code) {
      res.statusCode = code;
      return res;
    },
    json(body) {
      res.body = body;
      return res;
    },
  };
  return res;
}

const respondTo = (body) => {
  const res = fakeResponse();
  tagToDates({ body }, res);
  return res;
};

describe('POST /tag-to-dates — success', () => {
  test('resolves a startTag to the start of the period', () => {
    const res = respondTo({ startTag: 'my-tag-25.Q2.T1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ isoDate: '2025-04-01T00:00:00.000Z', isoDay: '2025-04-01' });
  });

  test('resolves an endTag to the end of the period', () => {
    const res = respondTo({ endTag: 'my-tag-25.Q2.T1' });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ isoDate: '2025-05-14T00:00:00.000Z', isoDay: '2025-05-14' });
  });

  test('takes the earliest start from a list of labels', () => {
    const res = respondTo({ startTag: 'planning, 2026.Q3.T1, 2026.Q1.T2' });

    expect(res.body.isoDay).toBe('2026-02-15');
  });

  test('takes the latest end from an array', () => {
    const res = respondTo({ endTag: ['2026.Q1.T2', '2026.Q3.T1'] });

    expect(res.body.isoDay).toBe('2026-08-14');
  });
});

describe('POST /tag-to-dates — rejections', () => {
  test('rejects both tags in one request', () => {
    const res = respondTo({ startTag: '2026.Q1.T1', endTag: '2026.Q2.T1' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveLength(1);
  });

  test('rejects a request with neither tag', () => {
    const res = respondTo({});

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveLength(1);
  });

  test('rejects a request with no body at all', () => {
    const res = fakeResponse();
    tagToDates({}, res);

    expect(res.statusCode).toBe(400);
  });

  test('rejects input containing no tag', () => {
    const res = respondTo({ startTag: 'planning, roadmap' });

    expect(res.statusCode).toBe(400);
    expect(res.body.errors).toHaveLength(1);
  });
});
