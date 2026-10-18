import { describe, expect, test } from 'vitest';
import { scoreField } from './score-field.js';

describe('scoreField', () => {
  test('scores a passing presence field as 100 times the field weight', () => {
    const result = scoreField({
      fieldKey: 'summary',
      config: { type: 'presence', weight: 0.25 },
      issue: { key: 'INIT-1', fields: { summary: 'Defined work' } },
      descendants: [],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldKey: 'summary', score: 25, maxScore: 25, passed: true });
  });

  test('scores a dropdown field from the option table', () => {
    const result = scoreField({
      fieldKey: 'risk',
      config: { type: 'dropdown', weight: 0.4, options: { High: 15, Medium: 50, Low: 100 } },
      issue: { key: 'INIT-1', fields: { risk: 'Low' } },
      descendants: [],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldKey: 'risk', score: 40, maxScore: 40, passed: true });
  });

  test('scores unique-increment using completed headings', () => {
    const result = scoreField({
      fieldKey: 'workstreamDetails',
      config: { type: 'unique-increment', weight: 0.5, options: { completed: 100, incomplete: 0 } },
      issue: { key: 'INC-1', fields: { workstreamDetails: '<h2>Problem</h2><p>Real details</p>' } },
      descendants: [],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldType: 'unique-increment', score: 50, passed: true });
  });
});
