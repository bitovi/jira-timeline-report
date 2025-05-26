



import type { DerivedIssue } from "../../../../jira/derived/derive";

import {partition, indexByKey, groupBy} from "../../../../utils/array/array-helpers"

import type {LinkedIssue} from "./link-issues";
import {resetLinkedIssue} from "./link-issues";
import {WorkPlans} from "./workplan";


type WorkIssue  = {
    linkedIssue: LinkedIssue;
    startDay: number | null;
    daysOfWork: number;
    artificiallyDelayed?: boolean;
}



export function makeWorkIssues(linkedIssues: LinkedIssue[], probablisticallySelectIssueTiming: boolean): WorkIssue[] {
    return linkedIssues.map(issue => {
        return {
            linkedIssue: issue,
            startDay: null,
            daysOfWork: probablisticallySelectIssueTiming ? issue.derivedTiming.probablisticTotalDaysOfWork : issue.derivedTiming.deterministicTotalDaysOfWork,
        }
    });
}

export function makeTeamWork(linkedIssues: LinkedIssue[]) {
    const groups = groupBy(linkedIssues, issue => issue.team.name);
    const teamWork = Object.keys(groups).map(teamKey => {
        const issue = groups[teamKey][0];
        return {
            teamKey, 
            workPlans: new WorkPlans(issue.team.parallelWorkLimit),
            velocity: issue.team.velocity
        }
    });
    return indexByKey(teamWork, "teamKey");
}

type TeamWorkIndex = ReturnType<typeof makeTeamWork>;

export function scheduleIssues(sortedLinkedIssues: LinkedIssue[]/*, probablisticallySelectIssueTiming: boolean*/){

    // reset linked isues 
    sortedLinkedIssues.forEach(resetLinkedIssue);

    const teamWork = makeTeamWork(sortedLinkedIssues);

    sortedLinkedIssues.forEach( (issue)=> {
        //log("planning", issue);
        // plan that issue out
        planIssue(issue, teamWork);
        //onPlannedIssueIncrement(issue, teamWork);
    });
    return teamWork;
}

// This function tries to plan an issue.
// It is recursive. It will plan the issue and then try to plan everything the issue
// blocks.
function planIssue(issue: LinkedIssue, workByTeams: TeamWorkIndex) {

    // Has everything that blocks this work already been scheduled?
    if( areAllBlockersScheduled(issue) ) {

        // schedule
        if(issue.mutableWorkItem.startDay == null) {
            // Look at each blocker and get the first date when all blockers will be done
            var firstDayWorkCouldStartOn = earliestStartTimeFromBlockers(issue);


            /*console.log(new Array(firstDayWorkCouldStartOn).join(" "),
              issue.blocksWorkDepth,
              issue.work.daysOfWork,
              issue.Summary,
              "rescheduled");*/

            // Try to place this work in the first place the team could absorb it.
            scheduleIssue(issue, firstDayWorkCouldStartOn , workByTeams);

            if(issue.linkedBlocks) {
                // this sorting can probably be done earlier, once for deterministic plans
                [...issue.linkedBlocks].sort((iA, iB) => iB.blocksWorkDepth - iA.blocksWorkDepth)
                    .forEach( block => planIssue(block, workByTeams) );
            }
        }

    } else {
      // If there is a blocker that hasn't been scheduled, we will wait on the blocker
      // to be scheduled.  It will then recurse to this issue and schedule it.
    }
}

// Try to find the first available time  the work could be scheduled for this team.
function scheduleIssue(linkedIssue: LinkedIssue, firstDayWorkCouldStartOn: number, teamWorkIndex: TeamWorkIndex) {

    var team = teamWorkIndex[linkedIssue.team.name];
    //if(work.issue["Issue key"] === "YUMPOS-4131") {
    //	debugger;
    //}

    team.workPlans.sheduleWork(linkedIssue.mutableWorkItem, firstDayWorkCouldStartOn);
    //console.log(new Array(Math.ceil(work.startDay / 2)).join(" "), work.startDay, work.issue.Summary)

}


// Start day is set on everything
function areAllBlockersScheduled(linkedIssue: LinkedIssue){
    return  linkedIssue.linkedBlockedBy.every( (issue)=> issue.mutableWorkItem.startDay != null )
}






function earliestStartTimeFromBlockers(issue: LinkedIssue) {
    return issue.linkedBlockedBy.reduce( (prev, blocker)=> {
        if(blocker.mutableWorkItem.startDay == null) {
            const error = new Error("Unable to calculate, no startDay");
            //@ts-ignore
            error.data = {issue, blocker};
            throw error;
        }
        return Math.max(prev, blocker.mutableWorkItem.startDay + blocker.mutableWorkItem.daysOfWork )
    }, 0);
}