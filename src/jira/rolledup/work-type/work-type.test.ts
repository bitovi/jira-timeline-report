// sum.test.js
import { expect, test } from 'vitest';
import { rollupWorkTypeDates } from './work-type';
import { IssueOrRelease } from '../../rollup/rollup';
import { WithDateRollup } from '../../rollup/dates/dates';

test('rollupWorkTypeDates all with dates', () => {
  const _2000 = new Date(2000, 0),
    _2001 = new Date(2001, 0),
    _2002 = new Date(2002, 0),
    _2003 = new Date(2003, 0),
    _2004 = new Date(2004, 0),
    _2005 = new Date(2005, 0),
    _2006 = new Date(2006, 0),
    _2007 = new Date(2007, 0);
  const input = [
    [
      {
        key: 'o-1',
        parentKey: null,
        derivedTiming: { start: _2000, due: _2007 },
        derivedStatus: { workType: 'dev' },
        type: 'outcome',
      },
    ],
    [
      {
        key: 'm-2',
        parentKey: 'o-1',
        derivedTiming: { start: _2001, due: _2004 },
        derivedStatus: { workType: 'dev' },
        type: 'milestone',
      },
      {
        key: 'm-3',
        parentKey: 'o-1',
        derivedTiming: { start: _2003, due: _2007 },
        derivedStatus: { workType: 'qa' },
        type: 'milestone',
      },
    ],
    [
      {
        key: 'i-4',
        parentKey: 'm-2',
        derivedTiming: { start: _2000, due: _2002 },
        derivedStatus: { workType: 'design' },
        type: 'initiative',
      },
      {
        key: 'i-5',
        parentKey: 'm-2',
        derivedTiming: { start: _2002, due: _2004 },
        derivedStatus: { workType: 'design' },
        type: 'initiative',
      },
      {
        key: 'i-6',
        parentKey: 'm-3',
        derivedTiming: { start: _2003, due: _2004 },
        derivedStatus: { workType: 'qa' },
        type: 'initiative',
      },
      {
        key: 'i-7',
        parentKey: 'm-3',
        derivedTiming: { start: _2004, due: _2007 },
        derivedStatus: { workType: 'qa' },
        type: 'initiative',
      },
    ],
  ].reverse() as IssueOrRelease<WithDateRollup>[][];

  const result = rollupWorkTypeDates(input);

  const prefiltered = result.map((r) => r.rollupData).reverse();

  const combinedRollupData = prefiltered.map((items) => items.map((i) => i.combined));

  // test an initiative
  expect(combinedRollupData[2][0]).toStrictEqual({
    design: {
      issueKeys: ['i-4'],
      start: _2000,
      due: _2002,
    },
  });

  // test an milestone

  expect(combinedRollupData[1][0]).toStrictEqual({
    design: {
      issueKeys: ['i-4', 'i-5'],
      start: _2000,
      due: _2004,
    },
    dev: {
      issueKeys: ['m-2'],
      start: _2001,
      due: _2004,
    },
  });
});

test('rollupWorkTypeDates only leaf dates', () => {
  const _2000 = new Date(2000, 0),
    _2001 = new Date(2001, 0),
    _2002 = new Date(2002, 0),
    _2003 = new Date(2003, 0),
    _2004 = new Date(2004, 0),
    _2005 = new Date(2005, 0),
    _2006 = new Date(2006, 0),
    _2007 = new Date(2007, 0);
  const input = [
    [
      {
        key: 'o-1',
        parentKey: null,
        derivedTiming: {},
        derivedStatus: { workType: 'dev' },
        type: 'outcome',
      },
    ],
    [
      {
        key: 'm-2',
        parentKey: 'o-1',
        derivedTiming: {},
        derivedStatus: { workType: 'dev' },
        type: 'milestone',
      },
      {
        key: 'm-3',
        parentKey: 'o-1',
        derivedTiming: {},
        derivedStatus: { workType: 'qa' },
        type: 'milestone',
      },
    ],
    [
      {
        key: 'i-4',
        parentKey: 'm-2',
        derivedTiming: { start: _2000, due: _2002 },
        derivedStatus: { workType: 'design' },
        type: 'initiative',
      },
      {
        key: 'i-5',
        parentKey: 'm-2',
        derivedTiming: { start: _2002, due: _2004 },
        derivedStatus: { workType: 'design' },
        type: 'initiative',
      },
      {
        key: 'i-6',
        parentKey: 'm-3',
        derivedTiming: { start: _2003, due: _2004 },
        derivedStatus: { workType: 'qa' },
        type: 'initiative',
      },
      {
        key: 'i-7',
        parentKey: 'm-3',
        derivedTiming: { start: _2004, due: _2007 },
        derivedStatus: { workType: 'qa' },
        type: 'initiative',
      },
    ],
  ].reverse() as IssueOrRelease<WithDateRollup>[][];

  const result = rollupWorkTypeDates(input);

  const prefiltered = result.map((r) => r.rollupData).reverse();

  const combinedRollupData = prefiltered.map((items) => items.map((i) => i.combined));

  // test an initiative
  expect(combinedRollupData[2][0]).toStrictEqual({
    design: {
      issueKeys: ['i-4'],
      start: _2000,
      due: _2002,
    },
  });

  // test an milestone

  expect(combinedRollupData[1][0]).toStrictEqual({
    design: {
      issueKeys: ['i-4', 'i-5'],
      start: _2000,
      due: _2004,
    },
  });

  expect(combinedRollupData[0][0]).toStrictEqual({
    design: {
      issueKeys: ['i-4', 'i-5'],
      start: _2000,
      due: _2004,
    },
    qa: {
      issueKeys: ['i-6', 'i-7'],
      start: _2003,
      due: _2007,
    },
  });
});
