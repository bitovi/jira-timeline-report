import { expect, test } from 'vitest';

import { NormalizeIssueConfig, normalizeIssue, normalizeParent } from './normalize';
import { parseDateIntoLocalTimezone } from '../../utils/date/date-helpers';
import { JiraIssue, ParentIssue } from '../shared/types';

const parent: ParentIssue = {
  key: 'test-parent',
  id: '23',
  fields: {
    summary: 'parent summary',
    issuetype: { name: 'bug', hierarchyLevel: 8 },
    status: { name: 'in progress' },
  },
};

const issue: JiraIssue = {
  id: '1',
  key: 'test-key',
  fields: {
    Team: null,
    Parent: parent,
    Summary: 'language packs',
    'Issue Type': { hierarchyLevel: 1, name: 'Epic' },
    Created: '2023-02-03T10:58:38.994-0600',
    Sprint: null,
    'Fix versions': [
      {
        id: '10006',
        name: 'SHARE_R1',
        archived: false,
        description: 'description',
        released: false,
        self: 'self-string',
      },
    ],
    'Epic Link': null,
    Labels: ['JTR-Testing'],
    'Start date': '20220715',
    'Parent Link': { data: { key: 'IMP-5' } },
    Rank: '0|hzzzzn:',
    'Due date': '20220716',
    Status: { id: '1', name: 'Done', statusCategory: { name: 'Done' } },
    'Project key': 'ORDER',
    'Issue key': 'ORDER-15',
    url: 'https://bitovi-training.atlassian.net/browse/ORDER-15',
    workType: 'dev',
    workingBusinessDays: 27,
    weightedEstimate: null,
  },
};

const startDate = new Date('20220715');
const dueDate = new Date('20220716');

test('normalizeParent', () => {
  expect(normalizeParent(parent)).toEqual({
    summary: 'parent summary',
    hierarchyLevel: 8,
    type: 'bug',
    key: 'test-parent',
  });
});

test('normalizeParent with overrides', () => {
  expect(
    normalizeParent(parent, {
      getSummary: () => 'hello',
      getHierarchyLevel: () => 21,
    }),
  ).toEqual({
    summary: 'hello',
    hierarchyLevel: 21,
    type: 'bug',
    key: 'test-parent',
  });
});

test('normalizeIssue', () => {
  expect(normalizeIssue(issue, {})).toEqual({
    summary: 'language packs',
    key: 'test-key',
    parentKey: 'test-parent',
    projectKey: 'test',
    confidence: null,
    dueDate,
    hierarchyLevel: 1,
    startDate,
    storyPoints: null,
    storyPointsMedian: null,
    type: 'Epic',
    sprints: null,
    team: {
      name: 'test',
      velocity: 21,
      daysPerSprint: 10,
      parallelWorkLimit: 1,
      totalPointsPerDay: 2.1,
      pointsPerDayPerTrack: 2.1,
      spreadEffortAcrossDates: false,
    },
    url: 'javascript://',
    status: 'Done',
    statusCategory: 'Done',
    labels: ['JTR-Testing'],
    releases: [
      {
        name: 'SHARE_R1',
        id: '10006',
        type: 'Release',
        key: 'SPECIAL:release-SHARE_R1',
        summary: 'SHARE_R1',
      },
    ],
    rank: '0|hzzzzn:',
    issue,
  });
});

test('normalizeIssue with custom getters', () => {
  const modifiedIssue = {
    ...issue,
    fields: {
      ...issue.fields,
      mockParentKey: 'mock',
      mockConfidence: 10,
      mockLevel: 1,
      newMedian: 9,
      mockStatus: 'nice',
    },
  };

  const overrides: NormalizeIssueConfig = {
    getTeamSpreadsEffortAcrossDates: () => false,
    getSummary: () => {
      return 'summary';
    },
    getIssueKey: ({ key }) => {
      return key + '1';
    },
    getParentKey: ({ fields }) => {
      if (typeof fields.mockParentKey === 'string') {
        return fields.mockParentKey;
      }

      return null;
    },
    getConfidence: ({ fields }) => {
      if (typeof fields.mockConfidence === 'number') {
        return fields.mockConfidence;
      }

      return null;
    },
    getDueDate: ({ fields }) => {
      return '2023-02-17T16:58:00.000Z';
    },
    getHierarchyLevel: ({ fields }) => {
      if ('mockLevel' in fields && typeof fields.mockLevel === 'number') {
        return fields.mockLevel;
      }

      throw new Error('Level must be provided');
    },
    getStartDate: ({ fields }) => {
      return '2023-02-17T16:58:00.000Z';
    },
    getStoryPoints: ({ fields }) => {
      if (typeof fields.shouldNotBeInIssue === 'number') {
        return fields.shouldNotBeInIssue;
      }

      return null;
    },
    getStoryPointsMedian: ({ fields }) => {
      if (typeof fields.newMedian === 'number') {
        return fields.newMedian;
      }

      return null;
    },
    getType: ({ fields }) => {
      return 'bug';
    },
    getTeamKey: ({ key }) => {
      return 'new fake team key';
    },
    getUrl: ({ key }) => {
      return 'fake url';
    },
    getVelocity: () => {
      return 1;
    },
    getDaysPerSprint: () => {
      return 20;
    },
    getParallelWorkLimit: () => {
      return 1;
    },
    getSprints: ({ fields }) => {
      return [];
    },
    getStatus: ({ fields }) => {
      if (typeof fields.mockStatus === 'string') {
        return fields.mockStatus;
      }

      return null;
    },
    getStatusCategory: ({ fields }) => {
      return null;
    },
    getLabels: ({ fields }) => {
      return ['label1'];
    },
    getReleases: () => {
      return [
        {
          id: 'release-1',
          key: '17',
          name: 'mock release',
          summary: 'its a release',
          type: 'Release',
        },
      ];
    },
    getRank: ({ fields }) => {
      return null;
    },
  };

  expect(normalizeIssue(modifiedIssue, overrides)).toEqual({
    summary: 'summary',
    key: 'test-key1',
    parentKey: 'mock',
    projectKey: 'test',
    confidence: 10,
    dueDate: parseDateIntoLocalTimezone('2023-02-17T16:58:00.000Z'),
    hierarchyLevel: 1,
    startDate: parseDateIntoLocalTimezone('2023-02-17T16:58:00.000Z'),
    storyPoints: null,
    storyPointsMedian: 9,
    type: 'bug',
    sprints: [],
    team: {
      name: 'new fake team key',
      velocity: 1,
      daysPerSprint: 20,
      parallelWorkLimit: 1,
      totalPointsPerDay: 0.05,
      pointsPerDayPerTrack: 0.05,
      spreadEffortAcrossDates: false,
    },
    url: 'fake url',
    status: 'nice',
    statusCategory: null,
    labels: ['label1'],
    releases: [
      {
        id: 'release-1',
        key: '17',
        name: 'mock release',
        summary: 'its a release',
        type: 'Release',
      },
    ],
    rank: null,
    issue: modifiedIssue,
  });
});

test.todo('allStatusSorted');

test.todo('allReleasesSorted');
