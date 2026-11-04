import { describe, expect, test } from 'vitest';
import { validateFutureHealthRequest } from './validate-future-health-request.js';

describe('validateFutureHealthRequest', () => {
  test('accepts a well-formed body and defaults debug to false', () => {
    const result = validateFutureHealthRequest('INIT-1', {
      issues: [{ key: 'INIT-1', fields: { issuetype: { name: 'Initiative' } } }],
      model: { issueType: 'Initiative', weight: 1, fields: { summary: { type: 'presence', weight: 1 } } },
    });

    expect(result.errors).toEqual([]);
    expect(result.normalizedRequest).toMatchObject({ issueKey: 'INIT-1', debug: false });
  });

  test('reports malformed body problems together', () => {
    const result = validateFutureHealthRequest(undefined, {});

    expect(result.normalizedRequest).toBeNull();
    expect(result.errors).toEqual([
      { message: 'issueKey path param is required' },
      { message: 'issues must be an array' },
      { message: 'model must be an object' },
    ]);
  });
});
