/**
 * This module
 */
export const workType = ["design", "dev", "qa", "uat"] as const;
export const workTypes = workType;

export const workflowHappyPath = ["todo", "design", "dev", "qa", "uat", "done"];
export const workflowUnhappyStatuses = ["blocked"];

const inQAStatus = { QA: true, "In QA": true, "QA Complete": true };
const inPartnerReviewStatus = { "Partner Review": true, UAT: true };
const inDoneStatus = { Done: true, Cancelled: true };
const blockedStatus = { Blocked: true, blocked: true, delayed: true, Delayed: true };

export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export const inIdeaStatus = { Idea: true, "To Do": true, Open: true };
export const inIdeaStatuses = Object.keys(inIdeaStatus);

type WorkType = (typeof workType)[number];

type Status =
  | keyof typeof inQAStatus
  | keyof typeof inPartnerReviewStatus
  | keyof typeof inIdeaStatus
  | keyof typeof inDoneStatus
  | keyof typeof blockedStatus
  | (string & {});

type StatusCategory = "qa" | "uat" | "todo" | "done" | "blocked";

export const statusCategoryMap = (function () {
  const items = [
    ["qa", inQAStatus],
    ["uat", inPartnerReviewStatus],
    ["todo", inIdeaStatus],
    ["done", inDoneStatus],
    ["blocked", blockedStatus],
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

export function getStatusTypeDefault(issue: { status?: string }): StatusCategory | "dev" {
  const statusCategory = statusCategoryMap[issue.status || ""];
  if (statusCategory) {
    return statusCategory;
  } else {
    return "dev";
  }
}

function toLowerCase(str: string): string {
  return str.toLowerCase();
}

const workPrefix = workType.map((wt) => wt + ":");

function getWorkTypeDefault(normalizedIssue: { summary?: string; labels?: string[] }): WorkType {
  let wp = workPrefix.find((wp) => (normalizedIssue?.summary || "").toLowerCase().indexOf(wp) === 0);

  if (wp) {
    return wp.slice(0, -1) as WorkType;
  }

  wp = workType.find((wt) => normalizedIssue.labels?.map(toLowerCase).includes(wt));

  if (wp) {
    return wp as WorkType;
  }

  return "dev";
}

const defaults = {
  getWorkTypeDefault,
  getStatusTypeDefault,
};

// TODO: See if other files beside normalize need this and if they do pull it out
type DefaultsToConfig<T> = {
  [K in keyof T as K extends `${infer FnName}Default` ? FnName : never]: T[K];
};

type WorkStatusConfig = DefaultsToConfig<typeof defaults>;

export function getWorkStatus(
  normalizedIssue: { summary?: string; labels?: string[]; status?: string },
  { getStatusType = getStatusTypeDefault, getWorkType = getWorkTypeDefault }: Partial<WorkStatusConfig> = {}
) {
  return {
    statusType: getStatusType(normalizedIssue),
    workType: getWorkType(normalizedIssue),
  };
}
