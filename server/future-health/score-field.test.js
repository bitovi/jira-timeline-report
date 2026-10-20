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
      config: {
        type: 'unique-increment',
        weight: 0.5,
        options: { Problem: 40, Opportunity: 60, 'Measure of Success': 20 },
      },
      issue: {
        key: 'INC-1',
        fields: { workstreamDetails: '<h2>Problem</h2><p>Real details</p><h2>Measure of Success</h2><p>Done</p>' },
      },
      descendants: [],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldType: 'unique-increment', score: 30, passed: true });
  });

  test('scores roll-up config objects with partial future visibility', () => {
    const result = scoreField({
      fieldKey: 'roll-up',
      config: {
        weight: 0.5,
        defined: { months: 6, weight: 0.5 },
        refined: { months: 3, weight: 0.5 },
      },
      issue: { key: 'INC-1', fields: { issuetype: { name: 'Increment' } } },
      descendants: [{ key: 'TASK-1', fields: { duedate: '2026-12-18', 'Story points': 8 } }],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldKey: 'roll-up', fieldType: 'roll-up', passed: true });
    expect(result.maxScore).toBe(50);
    expect(result.score).toBeCloseTo(25, 4);
  });

  test('scores nested field configs against nested issue values', () => {
    const result = scoreField({
      fieldKey: 'businessLead',
      config: {
        name: {
          type: 'presence',
          weight: 0.2,
        },
      },
      issue: {
        key: 'INIT-1',
        fields: {
          businessLead: {
            accountId: 'abc123',
            name: 'Ada Lovelace',
          },
        },
      },
      descendants: [],
      now: new Date('2026-10-18T00:00:00.000Z'),
    });

    expect(result).toMatchObject({ fieldKey: 'businessLead', fieldType: 'group', score: 20, maxScore: 20, passed: true });
    expect(result.fields).toEqual([
      expect.objectContaining({ fieldKey: 'name', fieldType: 'presence', score: 20, maxScore: 20, passed: true }),
    ]);
  });
});
