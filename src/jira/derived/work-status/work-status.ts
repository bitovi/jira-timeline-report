import { DefaultsToConfig, NormalizedIssue } from '../../shared/types';

/**
 * This module is repsonsible for determining the correct workType ("design", "dev", "qa", "uat")
 * and statusType ("qa", "uat", "todo", "done", "blocked") for an issue.
 */
export const workType = ['design', 'dev', 'qa', 'uat'] as const;
export const workTypes = workType;

export const workflowHappyPath = ['todo', 'design', 'dev', 'qa', 'uat', 'done'];
export const workflowUnhappyStatuses = ['blocked'];

const inQAStatus = { qa: true, 'in qa': true, 'qa complete': true };
const inPartnerReviewStatus = { 'partner review': true, uat: true };
const inDoneStatus = { done: true, cancelled: true };
const blockedStatus = { blocked: true, delayed: true };

export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export const inIdeaStatus = { idea: true, 'to do': true, open: true };
export const inIdeaStatuses = Object.keys(inIdeaStatus);

export type WorkType = (typeof workType)[number];

type Status =
  | keyof typeof inQAStatus
  | keyof typeof inPartnerReviewStatus
  | keyof typeof inIdeaStatus
  | keyof typeof inDoneStatus
  | keyof typeof blockedStatus
  | (string & {});

type StatusCategory = 'qa' | 'uat' | 'todo' | 'done' | 'blocked';

export type DerivedWorkStatus = {
  statusType: StatusCategory | 'dev';
  workType: WorkType;
};

export const statusCategoryMap = (function () {
  const items = [
    ['qa', inQAStatus],
    ['uat', inPartnerReviewStatus],
    ['todo', inIdeaStatus],
    ['done', inDoneStatus],
    ['blocked', blockedStatus],
  ] as const;

  const statusCategoryMap = {} as Record<Status, StatusCategory>;

  for (let [category, statusMap] of items) {
    for (let prop in statusMap) {
      const status = prop;
      statusCategoryMap[status] = category;
    }
  }

  return statusCategoryMap;
})();

export function getStatusTypeDefault(normalizedIssue: NormalizedIssue): StatusCategory | 'dev' {
  const statusCategory = statusCategoryMap[(normalizedIssue?.status || '').toLowerCase()];
  if (statusCategory) {
    return statusCategory;
  } else {
    return 'dev';
  }
}

const workPrefix = workType.map((wt) => wt + ':');

function getWorkTypeDefault(normalizedIssue: NormalizedIssue): WorkType {
  let wp = workPrefix.find((wp) => (normalizedIssue?.summary || '').toLowerCase().startsWith(wp));

  if (wp) {
    return wp.slice(0, -1) as WorkType;
  }

  wp = workType.find((wt) => {
    return normalizedIssue.labels?.map((label) => label.toLowerCase()).includes(wt);
  });

  if (wp) {
    return wp as WorkType;
  }

  return 'dev';
}

const defaults = {
  getWorkTypeDefault,
  getStatusTypeDefault,
};

export type WorkStatusConfig = DefaultsToConfig<typeof defaults>;

export function getWorkStatus(
  normalizedIssue: NormalizedIssue,
  { getStatusType = getStatusTypeDefault, getWorkType = getWorkTypeDefault }: Partial<WorkStatusConfig> = {},
): DerivedWorkStatus {
  return {
    statusType: getStatusType(normalizedIssue),
    workType: getWorkType(normalizedIssue),
  };
}
