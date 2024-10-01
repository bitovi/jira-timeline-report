const inQAStatus = { QA: true, "In QA": true, "QA Complete": true };
const inPartnerReviewStatus = { "Partner Review": true, UAT: true };
export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export const inIdeaStatus = { Idea: true, "To Do": true, Open: true };
export const inIdeaStatuses = Object.keys(inIdeaStatus);
const inDoneStatus = { Done: true, Cancelled: true };
const blockedStatus = { Blocked: true, blocked: true, delayed: true, Delayed: true };

const statusCategoryMap = (function () {
  const items = [
    ["qa", inQAStatus],
    ["uat", inPartnerReviewStatus],
    ["todo", inIdeaStatus],
    ["done", inDoneStatus],
    ["blocked", blockedStatus],
  ];
  const statusCategoryMap = {};
  for (let [category, statusMap] of items) {
    for (let prop in statusMap) {
      statusCategoryMap[prop] = category;
    }
  }
  return statusCategoryMap;
})();

const WIGGLE_ROOM = 0;

// clean up warnings
function warn(...args) {
  console.warn(
    ...args.map((arg) => {
      if ((arg && typeof arg === "object" && arg.Summary) || arg.release) {
        return '"' + (arg.Summary || arg.release) + '"' + (arg.url ? " (" + arg.url + ")" : "");
      } else {
        return arg;
      }
    })
  );
}

/**
 *
 * @param {import("./jira/derived/issue-data").NormalizedIssue} issue
 */
export function addStatusCategory(issue) {}

export function addStatusToRelease(release) {
  Object.assign(release.dateData.rollup, getReleaseStatus(release));
  Object.assign(release.dateData.dev, getReleaseDevStatus(release));
  Object.assign(release.dateData.qa, getReleaseQaStatus(release));
  Object.assign(release.dateData.uat, getReleaseUatStatus(release));
  return release;
}

function getReleaseStatus(release) {
  // if everything is complete
  const issuesNotComplete = release.dateData.children.issues.filter(function (i) {
    return i.dateData.rollup.status !== "complete";
  });

  if (issuesNotComplete.length === 0) {
    return {
      status: "complete",
      statusData: {
        message: "All initiatives are complete",
      },
    };
  }
  return getInitiativeStatus(release);
}
function getReleaseDevStatus(release) {
  return getInitiativeDevStatus(release);
}
function getReleaseQaStatus(release) {
  return getInitiativeQaStatus(release);
}
function getReleaseUatStatus(release) {
  return getInitiativeUatStatus(release);
}

export function addStatusToInitiative(initiative) {
  Object.assign(initiative.dateData.rollup, getInitiativeStatus(initiative));
  Object.assign(initiative.dateData.dev, getInitiativeDevStatus(initiative));
  Object.assign(initiative.dateData.qa, getInitiativeQaStatus(initiative));
  Object.assign(initiative.dateData.uat, getInitiativeUatStatus(initiative));
  return initiative;
}
export function addStatusToIssueAndChildren(issue) {
  addStatusToInitiative(issue);
  if (issue.dateData?.children?.issues?.length) {
    issue.dateData.children.issues.forEach(function (child) {
      Object.assign(child.dateData.rollup, getInitiativeStatus(child));
    });
  }
  return issue;
}

function getInitiativeStatus(initiative) {
  if (inDoneStatus[initiative.Status]) {
    return {
      status: "complete",
      statusData: {
        message: "Status is `DONE`",
      },
    };
  }
  const devStatus = getInitiativeDevStatus(initiative).status,
    qaStatus = getInitiativeQaStatus(initiative).status,
    uatStatus = getInitiativeUatStatus(initiative).status,
    statuses = [devStatus, qaStatus, uatStatus];
  if (statuses.every((s) => s === "complete")) {
    return {
      status: "complete",
      statusData: {
        warning: true,
        message: "Some epics have due dates in the past, but are not `DONE`",
      },
    };
  }
  if (
    statuses.some((s) => s.toLowerCase() === "blocked") ||
    (initiative.Status && initiative.Status.toLowerCase() === "blocked")
  ) {
    return {
      status: "blocked",
      statusData: {
        message: "Some epics are blocked",
      },
    };
  }

  const timedTeamStatus = timedStatus(initiative.dateData.rollup);

  const warning =
    timedTeamStatus === "complete" &&
    initiative.dateData.rollup?.issues?.length &&
    initiative.dateData.rollup?.issues?.every((epic) => !isStatusUatComplete(epic));

  return {
    status: timedTeamStatus,
    statusData: {
      warning: warning,
      message: warning ? "Some epics have due dates in the past, but are not `DONE`" : null,
    },
  };
}

function isStatusDevComplete(item) {
  return inQAStatus[item.Status] || isStatusQAComplete(item);
}
function isStatusQAComplete(item) {
  return inPartnerReviewStatus[item.Status] || isStatusUatComplete(item);
}
function isStatusUatComplete(item) {
  return inDoneStatus[item.Status];
}

function timedStatus(timedRecord) {
  if (!timedRecord.due) {
    return "unknown";
  }
  // if now is after the complete date
  // we force complete ... however, we probably want to warn if this isn't in the
  // completed state
  else if (+timedRecord.due < new Date()) {
    return "complete";
  } else if (timedRecord.lastPeriod && +timedRecord.due > WIGGLE_ROOM + +timedRecord.lastPeriod.due) {
    return "behind";
  } else if (timedRecord.lastPeriod && +timedRecord.due + WIGGLE_ROOM < +timedRecord.lastPeriod.due) {
    return "ahead";
  } else if (!timedRecord.lastPeriod) {
    return "new";
  }

  if (timedRecord.start > new Date()) {
    return "notstarted";
  } else {
    return "ontrack";
  }
}

export function getInitiativeDevStatus(initiative) {
  // check if epic statuses are complete
  if (isStatusDevComplete(initiative)) {
    return {
      status: "complete",
      statusData: { message: "initiative status is `DEV` complete" },
    };
  }
  const devDateData = initiative.dateData.dev;

  if (devDateData?.issues?.length && devDateData?.issues?.every((epic) => isStatusDevComplete(epic))) {
    // Releases don't have a status so we shouldn't throw this warning.
    return {
      status: "complete",
      statusData: {
        warning: !!initiative.Status,
        message: "All epics are dev complete. Move the issue to a `QA` status",
      },
    };
  }
  function epicIsBlocked(epic) {
    return epic.Status.toLowerCase() === "blocked";
  }

  if (devDateData?.issues?.some(epicIsBlocked)) {
    return {
      status: "blocked",
      statusData: {
        message: "An epic is blocked",
      },
    };
  }
  if (!devDateData) {
    return {
      status: "unknown",
      statusData: {
        warning: false,
        message: "Did not break down dev work on this level",
      },
    };
  }
  const timedDevStatus = timedStatus(devDateData);

  const warning =
    timedDevStatus === "complete" &&
    devDateData?.issues?.length &&
    devDateData?.issues?.every((epic) => !isStatusDevComplete(epic));
  return {
    status: timedDevStatus,
    statusData: {
      warning: warning,
      message: warning ? "Some epics have due dates in the past, but are not `DEV` complete" : null,
    },
  };
}

function getInitiativeQaStatus(initiative) {
  if (isStatusQAComplete(initiative)) {
    return {
      status: "complete",
      statusData: { message: "initiative status is `QA` complete" },
    };
  }
  const qaDateData = initiative.dateData.qa;
  if (!qaDateData) {
    return {
      status: "unknown",
      statusData: {
        warning: false,
        message: "Did not break down qa work within this issue",
      },
    };
  }

  if (qaDateData.issues.length && qaDateData.issues.every((epic) => isStatusQAComplete(epic))) {
    return {
      status: "complete",
      statusData: {
        warning: !!initiative.Status,
        message: "All QA epics are `QA` complete. Move the initiative to a `UAT` status",
      },
    };
  }
  if (initiative?.qa?.issues?.some((epic) => epic.Status.toLowerCase() === "blocked")) {
    return {
      status: "blocked",
      statusData: {
        message: "An epic is blocked",
      },
    };
  }
  const timedQAStatus = timedStatus(qaDateData);
  const warning =
    timedQAStatus === "complete" &&
    qaDateData?.issues?.length &&
    qaDateData?.issues?.every((epic) => !isStatusQAComplete(epic));

  return {
    status: timedQAStatus,
    statusData: {
      warning: warning,
      message: warning ? "Some epics have due dates in the past, but are not `QA` complete" : null,
    },
  };
}

function getInitiativeUatStatus(initiative) {
  if (isStatusUatComplete(initiative)) {
    return {
      status: "complete",
      statusData: { message: "initiative status is `UAT` complete" },
    };
  }
  const uatDateData = initiative.dateData.uat;
  if (!uatDateData) {
    return {
      status: "unknown",
      statusData: {
        warning: false,
        message: "Did not break down uat work within this issue",
      },
    };
  }

  if (uatDateData.issues.length && uatDateData.issues.every((epic) => isStatusUatComplete(epic))) {
    // Releases don't have a status so we shouldn't throw this warning.
    return {
      status: "complete",
      statusData: {
        warning: !!initiative.Status,
        message: "All UAT epics are `UAT` complete. Move the initiative to a `DONE` status",
      },
    };
  }
  if (uatDateData?.issues?.some((epic) => epic.Status.toLowerCase() === "blocked")) {
    return {
      status: "blocked",
      statusData: {
        message: "An epic is blocked",
      },
    };
  }

  // should timed status be able to look at the actual statuses?
  // lets say the UAT is "ontrack" (epicStatus won't report this currently)
  // should we say there is a missmatch?
  const statusFromTiming = timedStatus(uatDateData);

  const warning =
    statusFromTiming === "complete" &&
    uatDateData?.issues?.length &&
    uatDateData?.issues?.every((epic) => !isStatusUatComplete(epic));

  return {
    status: statusFromTiming,
    statusData: {
      warning: warning,
      message: warning ? "Some epics have due dates in the past, but are not `UAT` complete" : null,
    },
  };
}

/*
export function getEpicStatus(epic) {
	debugger;
		if (inQAStatus[epic.Status] || inPartnerReviewStatus[epic.Status] || inDoneStatus[epic.Status]) {
				return "complete";
		} else if (!epic["Due date"]) {
				return "unknown"
		} else if (new Date(epic["Due date"]) > WIGGLE_ROOM + (+epic.dueLastPeriod)) {
				return "behind"
		} else {
				return "ontrack";
		}
}

export function addStatusToEpic(epic) {
		return {
				...epic,
				status: getEpicStatus(epic)
		};
}*/

export function getBusinessDatesCount(startDate, endDate) {
  let count = 0;
  const curDate = new Date(startDate.getTime());
  while (curDate <= endDate) {
    const dayOfWeek = curDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) count++;
    curDate.setDate(curDate.getDate() + 1);
  }
  return count;
}
