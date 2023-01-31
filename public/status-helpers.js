const inQAStatus = { "QA": true, "In QA": true, "QA Complete": true };
const inDevStatus = { "In Development": true, "To Do": true };
const inPartnerReviewStatus = { "Partner Review": true, "UAT": true };
export const inPartnerReviewStatuses = Object.keys(inPartnerReviewStatus);
const inDoneStatus = { "Done": true, "Cancelled": true };
const blockedStatus = { "Blocked": true }


const WIGGLE_ROOM = 0;

export function addStatusToRelease(release) {

		return {
				...release,
				status: getReleaseStatus(release),
				devStatus: getReleaseDevStatus(release),
				qaStatus: getReleaseQaStatus(release),
				uatStatus: getReleaseUatStatus(release)
		}
}

function getReleaseStatus(release) {
		// if everything is complete
		if (release.initiatives.filter(i => i.status !== "complete").length === 0) {
				return "complete"
		}
		const latest = release.initiatives.reduce( (acc, cur)=> {
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
		return {
				...initiative,
				status: getInitiativeStatus(initiative),
				devStatus: getInitiativeDevStatus(initiative),
				qaStatus: getInitiativeQaStatus(initiative),
				uatStatus: getInitiativeUatStatus(initiative)
		}
}

function getInitiativeStatus(initiative) {
		if (inDoneStatus[initiative.Status]) {
				return "complete"
		}
		const devStatus = getInitiativeDevStatus(initiative),
			qaStatus = 	getInitiativeQaStatus(initiative),
			uatStatus = getInitiativeUatStatus(initiative),
			statuses = [devStatus,qaStatus,uatStatus];
		if(
			statuses.every(s => s === "complete")
		) {
			console.warn("All work for", initiative, "is complete, but the initiaitve is not DONE");
			return "complete"
		}
		if(statuses.some(s => s === "blocked")) {
			return "blocked"
		}

		return timedStatus(initiative.team);
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
		} else if ((+timedRecord.due) > WIGGLE_ROOM + (+timedRecord.dueLastPeriod)) {
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
				return "complete";
		}
		if (initiative?.dev?.issues?.every(epic => isStatusDevComplete(epic))) {
				console.warn("The dev epics for", initiative, "are complete, but the issue is not in QA");
				return "complete"
		}
		if (initiative?.dev?.issues?.some(epic => epic.Status === "Blocked")) {
				return "blocked"
		}
		return timedStatus(initiative.dev)
}

function getInitiativeQaStatus(initiative) {
		if (isStatusQAComplete(initiative)) {
				return "complete";
		}
		if (initiative.qa.length && initiative.qa.issues.every(epic => isStatusQAComplete(epic))) {
				console.warn("The qa epics for", initiative, "are complete, but the issue is not in UAT");
				return "complete"
		}
		if (initiative?.qa?.issues?.some(epic => epic.Status === "Blocked")) {
				return "blocked"
		}
		return timedStatus(initiative.qa)
}

function getInitiativeUatStatus(initiative) {
		if (isStatusUatComplete(initiative)) {
				return "complete";
		}
		if (initiative.uat.length && initiative.uat.issues.every(epic => isStatusUatComplete(epic))) {
				console.warn("The uat epics for", initiative, "are complete, but the issue is not DONE");
				return "complete"
		}
		if (initiative?.uat?.issues?.some(epic => epic.Status === "Blocked")) {
				return "blocked"
		}
		return timedStatus(initiative.uat)
}




export function getEpicStatus(epic) {
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
}

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
