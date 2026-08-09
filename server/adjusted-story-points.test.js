import { describe, test, expect } from 'vitest';
import adjustedStoryPoints from './adjusted-story-points.js';

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
  adjustedStoryPoints({ body }, res);
  return res;
};

const messages = (res) => res.body.errors.map((error) => error.message);

describe('POST /adjusted-story-points — success', () => {
  // Recorded from the auto-scheduler host this endpoint is moving off of, so a
  // re-pointed Automation rule keeps getting the same numbers.
  test('matches the values the previous host returned', () => {
    const res = respondTo({ storyPointsMedian: 10, storyPointsConfidence: 20 });

    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      adjustedStoryPoints: 26.44653598619911,
      extraStoryPoints: 16.44653598619911,
      roundedExtraStoryPoints: 16,
      roundedAdjustedStoryPoints: 26,
    });
  });

  test('accepts an explicit riskThreshold', () => {
    const res = respondTo({
      storyPointsMedian: 10,
      storyPointsConfidence: 20,
      riskThreshold: 50,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.roundedAdjustedStoryPoints).toBe(10);
  });

  test('accepts the "average" riskThreshold', () => {
    const res = respondTo({
      storyPointsMedian: 10,
      storyPointsConfidence: 20,
      riskThreshold: 'average',
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.roundedAdjustedStoryPoints).toBe(19);
  });

  test('honours a riskThreshold of 0 instead of defaulting it to 80', () => {
    const res = respondTo({
      storyPointsMedian: 10,
      storyPointsConfidence: 20,
      riskThreshold: 0,
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.roundedAdjustedStoryPoints).toBe(0);
  });

  test('a median of 0 needs no buffer', () => {
    const res = respondTo({ storyPointsMedian: 0, storyPointsConfidence: 20 });

    expect(res.statusCode).toBe(200);
    expect(res.body.adjustedStoryPoints).toBe(0);
  });
});

describe('POST /adjusted-story-points — rejections', () => {
  test('reports every missing field at once', () => {
    const res = respondTo({});

    expect(res.statusCode).toBe(400);
    expect(messages(res)).toEqual(['storyPointsMedian is undefined', 'storyPointsConfidence is undefined']);
  });

  test('rejects a request with no body at all', () => {
    const res = fakeResponse();
    adjustedStoryPoints({}, res);

    expect(res.statusCode).toBe(400);
  });

  test('rejects a numeric string', () => {
    const res = respondTo({ storyPointsMedian: '10', storyPointsConfidence: 20 });

    expect(res.statusCode).toBe(400);
    expect(messages(res)).toEqual(['storyPointsMedian is not a number']);
  });

  test('rejects out-of-range values', () => {
    const res = respondTo({ storyPointsMedian: -1, storyPointsConfidence: 200 });

    expect(res.statusCode).toBe(400);
    expect(messages(res)).toEqual(['storyPointsMedian is negative', 'storyPointsConfidence is greater than 100']);
  });

  test('rejects an unusable riskThreshold rather than returning nulls', () => {
    const res = respondTo({
      storyPointsMedian: 10,
      storyPointsConfidence: 20,
      riskThreshold: 'abc',
    });

    expect(res.statusCode).toBe(400);
    expect(messages(res)).toEqual(['riskThreshold is not a number']);
  });
});
