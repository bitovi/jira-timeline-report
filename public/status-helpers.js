const inQAStatus = { "QA": true, "In QA": true, "QA Complete": true };
const inPartnerReviewStatus = { "Partner Review": true, "UAT": true };
export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
export const inIdeaStatus = {"Idea": true, "To Do": true, "Open": true};
export const inIdeaStatuses =  Object.keys(inIdeaStatus);
const inDoneStatus = { "Done": true, "Cancelled": true };
const blockedStatus = { "Blocked": true }


const WIGGLE_ROOM = 0;

// clean up warnings
function warn(...args){

	console.warn(...args.map(arg => {
		if(arg && typeof arg === "object" && arg.Summary || arg.release) {
			return '"'+(arg.Summary || arg.release)+'"' +(arg.url ?  " ("+arg.url+")" : "") 
		} else {
			return arg;
		}
	}))
}

export function addStatusToRelease(release) {
	return {
		...release,
		...getReleaseQaStatus(release),
		...getReleaseDevStatus(release),
		...getReleaseUatStatus(release),
		...getReleaseStatus(release)
	}
}

function getReleaseStatus(release) {
		// if everything is complete
		if (release.initiatives.filter(i => i.status !== "complete").length === 0) {
			return {
				status: "complete", 
				statusData: {
					message: "All initiatives are complete"
				}
			};
		}
		/*const latest = release.initiatives.reduce( (acc, cur)=> {
			if(!acc) {
				return cur;
			}
			if(cur.team.due > acc.team.due) {
				return cur;
			} else {
				return acc;
			}
		})
		if(latest.status !== "notstarted" && latest.status !== "unknown") {
			return latest.status;
		}*/
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
		return {
				...initiative,
				...getInitiativeDevStatus(initiative),
				...getInitiativeQaStatus(initiative),
				...getInitiativeUatStatus(initiative),
				...getInitiativeStatus(initiative),
		}
}

function getInitiativeStatus(initiative) {
		if (inDoneStatus[initiative.Status]) {
				return {
					status: "complete", 
					statusData: {
						message: "Status is `DONE`"
					}
				};
		}
		const devStatus = getInitiativeDevStatus(initiative).devStatus,
			qaStatus = 	getInitiativeQaStatus(initiative).qaStatus,
			uatStatus = getInitiativeUatStatus(initiative).uatStatus,
			statuses = [devStatus,qaStatus,uatStatus];
		if(
			statuses.every(s => s === "complete")
		) {
			return {
				status: "complete", 
				statusData: {
					warning: true,
					message: "Some epics have due dates in the past, but are not `DONE`"
				}
			};
		}
		if(statuses.some(s => s === "blocked")) {
			return {
				status: "blocked", 
				statusData: {
					message: "Some epics are blocked"
				}
			};
		}

		const timedTeamStatus = timedStatus(initiative.team);

		const warning = timedTeamStatus === "complete" && 
			initiative?.team?.issues?.length && initiative?.team?.issues?.every(epic => !isStatusUatComplete(epic));
		
		return {
			status: timedTeamStatus, 
			statusData: {
				warning: warning,
				message: warning ? "Some epics have due dates in the past, but are not `DONE`" : null
			}
		};
}

function isStatusDevComplete(item) {
		return inQAStatus[item.Status] || isStatusQAComplete(item);
}
function isStatusQAComplete(item) {
		return inPartnerReviewStatus[item.Status] || isStatusUatComplete(item);
}
function isStatusUatComplete(item) {
		return inDoneStatus[item.Status]
}

function timedStatus(timedRecord) {
		if (!timedRecord.due) {
				return "unknown"
		}
		// if now is after the complete date
		// we force complete ... however, we probably want to warn if this isn't in the
		// completed state
		else if( (+timedRecord.due) < new Date()  ) {
			return "complete";
		} else if (timedRecord.lastPeriod && 
			((+timedRecord.due) > WIGGLE_ROOM + (+timedRecord.lastPeriod.due)) ) {
				return "behind";
		} else if (timedRecord.start > new Date()) {
				return "notstarted"
		}
		else {
				return "ontrack"
		}
}

export function getInitiativeDevStatus(initiative) {

		// check if epic statuses are complete
		if (isStatusDevComplete(initiative)) {
			return {
				devStatus: "complete", 
				devStatusData: {message: "initiative status is `DEV` complete"}
			};
		}
		if (initiative?.dev?.issues?.length && initiative?.dev?.issues?.every(epic => isStatusDevComplete(epic))) {
			// Releases don't have a status so we shouldn't throw this warning.
			return {
				devStatus: "complete", 
				devStatusData: {
					warning: !!initiative.Status,
					message: "All epics are dev complete. Move the issue to a `QA` status"
				}
			};
				return "complete"
		}
		if (initiative?.dev?.issues?.some(epic => epic.Status === "Blocked")) {
			return {
				devStatus: "blocked", 
				devStatusData: {
					message: "An epic is blocked"
				}
			};
		}
		const timedDevStatus = timedStatus(initiative.dev);

		const warning = timedDevStatus === "complete" && 
			initiative?.dev?.issues?.length && initiative?.dev?.issues?.every(epic => !isStatusDevComplete(epic));
		return {
			devStatus: timedDevStatus, 
			devStatusData: {
				warning: warning,
				message: warning ? "Some epics have due dates in the past, but are not `DEV` complete" : null
			}
		};
}

function getInitiativeQaStatus(initiative) {
		if (isStatusQAComplete(initiative)) {
			return {
				qaStatus: "complete", 
				qaStatusData: {message: "initiative status is `QA` complete"}
			};
		}
		if (initiative.qa.issues.length && initiative.qa.issues.every(epic => isStatusQAComplete(epic))) {
			return {
				qaStatus: "complete", 
				qaStatusData: {
					warning: !!initiative.Status,
					message: "All QA epics are `QA` complete. Move the initiative to a `UAT` status"
				}
			};
		}
		if (initiative?.qa?.issues?.some(epic => epic.Status === "Blocked")) {
			return {
				qaStatus: "blocked", 
				qaStatusData: {
					message: "An epic is blocked"
				}
			};
		}
		const timedQAStatus = timedStatus(initiative.qa);
		const warning = timedQAStatus === "complete" && 
			initiative?.qa?.issues?.length && initiative?.qa?.issues?.every(epic => !isStatusQAComplete(epic));

		return {
			qaStatus: timedQAStatus, 
			qaStatusData: {
				warning: warning,
				message: warning ? "Some epics have due dates in the past, but are not `QA` complete" : null
			}
		};
}

function getInitiativeUatStatus(initiative) {
	if (isStatusUatComplete(initiative)) {
		return {
			uatStatus: "complete", 
			uatStatusData: {message: "initiative status is `UAT` complete"}
		};
	}
	if (initiative.uat.issues.length && initiative.uat.issues.every(epic => isStatusUatComplete(epic))) {
		// Releases don't have a status so we shouldn't throw this warning.
		return {
			uatStatus: "complete", 
			uatStatusData: {
				warning: !!initiative.Status,
				message: "All UAT epics are `UAT` complete. Move the initiative to a `DONE` status"
			}
		};
	}
	if (initiative?.uat?.issues?.some(epic => epic.Status === "Blocked")) {
		return {
			uatStatus: "blocked", 
			uatStatusData: {
				message: "An epic is blocked"
			}
		};
	}

	// should timed status be able to look at the actual statuses?
	// lets say the UAT is "ontrack" (epicStatus won't report this currently)
	// should we say there is a missmatch?
	const statusFromTiming = timedStatus(initiative.uat);

	const warning = statusFromTiming === "complete" && 
		initiative?.uat?.issues?.length && initiative?.uat?.issues?.every(epic => !isStatusUatComplete(epic));

	return {
		uatStatus: statusFromTiming, 
		uatStatusData: {
			warning: warning,
			message: warning ? "Some epics have due dates in the past, but are not `UAT` complete" : null
		}
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
