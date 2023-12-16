import { estimateExtraPoints } from "../confidence.js";
import {
    addStatusToInitiative,
    addStatusToRelease, getBusinessDatesCount, inPartnerReviewStatuses
} from "../status-helpers.js";

import { howMuchHasDueDateMovedForwardChangedSince,
    DAY_IN_MS, parseDateISOString, epicTimingData } from "../date-helpers.js";

import {issues as rollbackIssues} from "../rollback/rollback.js";
import { getIssueWithDateData } from "./date-data.js";
//import { ObservableObject, value } from "//unpkg.com/can@6/core.mjs";

export function partition(arr, predicate) {
    let passed = [];
    let failed = [];

    for (const item of arr) {
        if (predicate(item)) {
            passed.push(item);
        } else {
            failed.push(item);
        }
    }

    return { passed, failed };
};

function toCVSFormat(issues, serverInfo) {
    return issues.map(issue => {
        return {
            ...issue.fields,
            changelog: issue.changelog,
            "Project key": issue.key.replace(/-.*/, ""),
            "Issue key": issue.key,
            url: serverInfo.baseUrl + "/browse/" + issue.key,
            "Issue Type": issue.fields["Issue Type"].name,
            "Product Target Release": issue.fields["Product Target Release"]?.[0],
            "Parent Link": issue.fields["Parent Link"]?.data?.key,
            "Status": issue.fields["Status"]?.name
        }
    })
}

function addWorkingBusinessDays(issues) {

    return issues.map(issue => {
        let weightedEstimate = null;
        if (issue["Story Points"]) {
            if (issue["Confidence"]) {
                weightedEstimate = issue["Story Points"] + Math.round(estimateExtraPoints(issue["Story Points"], issue["Confidence"]));
            } else {
                weightedEstimate = issue["Story Points"];
            }
        }

        return {
            ...issue,
            workType: isQAWork(issue) ? "qa" : (isPartnerReviewWork(issue) ? "uat" : "dev"),
            workingBusinessDays:
                issue["Due date"] && issue["Start date"] ?
                    getBusinessDatesCount(new Date(issue["Start date"]), new Date(issue["Due date"])) : null,
            weightedEstimate: weightedEstimate
        };
    })
}

// This is the "base" format everything else will use
export function rawIssuesToBaseIssueFormat(rawIssues, serverInfo) {
    return addWorkingBusinessDays(toCVSFormat(rawIssues, serverInfo ) );
}

export function isInitiative(issue) {
    return issue["Issue Type"].includes("Initiative");
}

export function filterOutStatuses(issues, statuses) {
    return issues.filter(issue => !statuses.includes(issue.Status))
}

export function filterOutInitiativeStatuses(issues, statuses) {
    return issues.filter(issue => !isInitiative(issue) || !statuses.includes(issue.Status))
}

// as long as it includes the word initiative
function filterInitiatives(issues) {
    return issues.filter(isInitiative)
}


function getIssuesMappedByParentKey(baseIssues){
    const map = {};
    for (const issue of baseIssues) {
        const parentKeyValue = issue["Parent Link"] || issue["Epic Link"];
        if ( parentKeyValue ) {
            if (!map[parentKeyValue]) {
                map[parentKeyValue] = []
            }
            map[parentKeyValue].push(issue);
        }
    }
    return map;
}

function getIssueMap(baseIssues) {
    const map = {};
    for (const issue of baseIssues) {
        const keyValue = issue["Issue key"];
        map[keyValue] = issue;
    }
    return map;
}





/**
 * @param {*} baseEpic 
 * @param {*} issuesMappedByParentKey 
 * @returns An epic with {start, due, children, startFrom, endTo}
 */
function getEpicTiming(baseEpic, issuesMappedByParentKey){
    const children = issuesMappedByParentKey[baseEpic["Issue key"]];
    let {startData, dueData} = getStartDateAndDueDataDirectlyFromIssue(baseEpic);
 
    if(startData && dueData) {
        return {
            ...baseEpic, 
            ...startData,
            ...dueData, 
            children
        };
    } else {
        // lets try to get timing from stories and sprints
        
        if(children) {
            const datesFromStories = getStartAndDueDatesFromStoriesAndSprints(children);
            if(datesFromStories) {
                startData = startData || {start: datesFromStories.start, startFrom: datesFromStories.startFrom };
                dueData = dueData || {due: datesFromStories.due, dueTo: datesFromStories.dueTo};
                return {
                    ...baseEpic,
                    ...startData,
                    ...dueData,
                    children
                }
            } 
        }
    }
    //console.warn("Unable to find timing information for", baseEpic.Summary, baseEpic.url);
    return {...baseEpic, start: null, due: null};
}

function filterQAWork(issues) {
    return filterByLabel(issues, "QA")
}
export function isQAWork(issue) {
    return filterQAWork([issue]).length > 0
}

function filterPartnerReviewWork(issues) {
    return filterByLabel(issues, "UAT")
}
export function isPartnerReviewWork(issue) {
    return filterPartnerReviewWork([issue]).length > 0
}

function filterByLabel(issues, label) {
    return issues.filter(
        issue => (issue.Labels || []).filter(
            l => l.includes(label)
        ).length
    );
}

function getWorkTypeBreakdown(timedEpics) {
    const qaEpics = new Set(filterQAWork(timedEpics));
    const uatEpics = new Set(filterPartnerReviewWork(timedEpics));
    const devEpics = timedEpics.filter(epic => !qaEpics.has(epic) && !uatEpics.has(epic));
    return {
        team: epicTimingData(timedEpics),
        dev: epicTimingData([...devEpics]),
        qa: epicTimingData([...qaEpics]),
        uat: epicTimingData([...uatEpics])
    };
}
// only exported for testing
/*
export function initiativesWithTimedEpics(baseIssues){
    const issuesMappedByParentKey = getIssuesMappedByParentKey(baseIssues);
    const initiativesToShow = filterInitiatives(baseIssues);

    return initiativesToShow.map((i) => {
        const baseEpicsOfInitiative = (issuesMappedByParentKey[i["Issue key"]] || []);

        // get timing information of each epic
        // THIS SHOULD BE GET CHILDREN TIMING ...
        const timedEpics = baseEpicsOfInitiative.map((e) => {
            return getEpicTiming(e, issuesMappedByParentKey)
        });
        
        // previously we would add status 
        // but now we are going to add status at the very end, when we can 
        
        // try to figure out what is dev or QA
       
        //const {startData, dueData} = getStartDateAndDueDataDirectlyFromIssue(i);
        //console.log(i, startData, dueData);
        return {
            ...i,
            ...getWorkTypeBreakdown(timedEpics)
        };
    })
}*/

function useMyValuesFirstThenUseChildren(reportedIssue, issuesMappedByParentKey, getIssueTimingFromDatesOrSprints){

}

function determineFromChildenIgnoreParentValues(reportedIssues, issuesMappedByParentKey, getIssueTimingFromDatesOrSprints, getChildWorkBreakdown){
    return reportedIssues.map((i) => {
        const childrenOfReportedIssues = (issuesMappedByParentKey[i["Issue key"]] || []);


    });
}

export function reportedIssueTypeTimingWithChildrenBreakdown({
    baseIssues,
    reportedIssueType = "Initiative",
    reportedStatuses = function(status){
        return !["Done"].includes(status)
    },
    getChildWorkBreakdown = function(children = []) {
        const qaWork = new Set(filterQAWork(children));
        const uatWork = new Set(filterPartnerReviewWork(children));
        const devWork = children.filter(epic => !qaWork.has(epic) && !uatWork.has(epic));
        return {qaWork, uatWork, devWork}
    },
    timingMethods
}){
    const issuesMappedByParentKey = getIssuesMappedByParentKey(baseIssues);

    // get items we are reporting
    const reportedIssues = baseIssues.filter( issue => issue["Issue Type"].includes(reportedIssueType) && reportedStatuses(issue.Status));

    return reportedIssues.map( (issue)=> {
        const reportedIssueWithTiming = getIssueWithDateData(issue, issuesMappedByParentKey, timingMethods);
        const timedChildren = reportedIssueWithTiming.children || [];
        const workBreakdown = getChildWorkBreakdown(timedChildren);
        Object.assign(reportedIssueWithTiming, {
            team: epicTimingData(timedChildren),
            dev: epicTimingData([...workBreakdown.devWork]),
            qa: epicTimingData([...workBreakdown.qaWork]),
            uat: epicTimingData([...workBreakdown.uatWork])
        });
        
        return reportedIssueWithTiming;
    })
}





// the problem here ... is that we need to roll back at every point
// we'd have to rollback each value and track what the new due date is 
//
// why would we need to rollback each value and see the change over time?
// why can't we just "rollback" to the prior state and compare?
// 
// we could see each mutation and 
// percolate the changes upward 
// 
// I might be able to go through "weak" version ... 
function reportedIssueTiming(options){
    const {
        baseIssues, 
        priorTime,
        reportedIssueType,
        reportedStatuses,
        timingMethods
    } = options;
    const currentInitiatives = reportedIssueTypeTimingWithChildrenBreakdown(options);

    const rolledBackBaseIssues = rollbackIssues(baseIssues, priorTime);

    const priorInitiatives = reportedIssueTypeTimingWithChildrenBreakdown({baseIssues: rolledBackBaseIssues});
    
    // copy prior initiative timing information over 
    const priorInitiativeMap = getIssueMap(priorInitiatives);
    for(const currentInitiative of currentInitiatives) {
        const priorInitiative = priorInitiativeMap[currentInitiative["Issue key"]];
        if(priorInitiative) {
            // copy timing
            
            currentInitiative.lastPeriod = priorInitiative;
            currentInitiative.team.lastPeriod = priorInitiative.team;
            currentInitiative.dev.lastPeriod = priorInitiative.dev;
            currentInitiative.qa.lastPeriod = priorInitiative.qa;
            currentInitiative.uat.lastPeriod = priorInitiative.uat;
        } else {
            // it's missing leave timing alone
            
            currentInitiative.lastPeriod = null;
            currentInitiative.team.lastPeriod = null;
            currentInitiative.dev.lastPeriod = null;
            currentInitiative.qa.lastPeriod = null;
            currentInitiative.uat.lastPeriod = null;
            
        }
    }
    
    return {
        currentInitiativesWithStatus: currentInitiatives.map(addStatusToInitiative),
        priorInitiatives
    } 
}


export function initiativesWithPriorTiming(baseIssues, priorTime){
    return priorInitiativeTiming(baseIssues, priorTime).currentInitiativesWithStatus
};


function getReleaseData (issue) {
    return {releaseName: issue?.["Fix versions"]?.[0]?.name, releaseId: issue?.["Fix versions"]?.[0]?.id};
}


function filterReleases(issues) {
    return issues.filter(issue => getReleaseData(issue).releaseName)
}



function mapOfReleaseIdsToNames(initiatives) {
    const map = new Map();
    for(const initiative of initiatives) {
        const {releaseId, releaseName} = getReleaseData(initiative);
        if(releaseId) {
            map.set(releaseId,releaseName );
        }
    }
    return map;
}
function mapOfReleaseNamesToReleasesWithInitiatives(initiatives) {
    const map = new Map();
    for(const initiative of initiatives) {
        const {releaseName} = getReleaseData(initiative);
        if(releaseName) {
            if(!map.has(releaseName)) {
                map.set(releaseName,{release: releaseName, initiatives: [], lastPeriod: null})
            }
            map.get(releaseName ).initiatives.push(initiative);
        }
    }
    return map;
}

// SIDE EFFECTS
function addWorkTypeBreakdownForRelease(release) {
    // get all initiative's team.issues 
    const allEpics = release.initiatives.map( initiative => initiative.team.issues ).flat();
    Object.assign(release, getWorkTypeBreakdown(allEpics))
}

export function releasesAndInitiativesWithPriorTiming(options){
    const {currentInitiativesWithStatus,priorInitiatives} = reportedIssueTiming(options);

    const currentInitiativesWithARelease = filterReleases(currentInitiativesWithStatus);
    const priorInitiativesWithARelease = filterReleases(priorInitiatives);

    // Make a map where we can look for prior releases's initiatives

    // {1234: "ALPHA", 4321: "ALPHA"}
    const currentReleaseIdsToNames = mapOfReleaseIdsToNames(currentInitiativesWithARelease);
    // {"ALPHA": {release: "ALPHA", initiatives: []}}
    const releaseMap = mapOfReleaseNamesToReleasesWithInitiatives(currentInitiativesWithARelease);

    // Add prior initiatives to each release
    for(const priorInitiative of priorInitiativesWithARelease) {
        const {releaseId, releaseName} = getReleaseData(priorInitiative);
        let release = releaseMap.get(releaseName);
        if(!release) {
            const releaseNameForId = currentReleaseIdsToNames.get(releaseId);
            if(releaseNameForId) {
                release = releaseMap.get(releaseNameForId);
            }
        }
        if(!release) {
            console.warn("Unable to find current release matching old release", releaseName+".", 
            "The initiative",'"'+priorInitiative.Summary+'"',"timing will be ignored")
        } else {

            // mark this release as having a lastPeriod if it doesn't already
            if(!release.lastPeriod){
                release.lastPeriod = {initiatives: []};
            }
            release.lastPeriod.initiatives.push(priorInitiative);
        }
    }
    // now go and add timing data to each release in the release map ...
    for(const [releaseName, release] of releaseMap) {
        addWorkTypeBreakdownForRelease(release);
        if(release.lastPeriod) {
            addWorkTypeBreakdownForRelease(release.lastPeriod);
            release.team.lastPeriod = release.lastPeriod.team;
            release.dev.lastPeriod = release.lastPeriod.dev;
            release.qa.lastPeriod = release.lastPeriod.qa;
            release.uat.lastPeriod = release.lastPeriod.uat;
        }
    }
    
    return {
        releases: [...releaseMap.values()].map(addStatusToRelease),
        initiatives: currentInitiativesWithStatus
    };

};

/*
function getTimingForInitiative(initiative, issuesMappedByParentKey) {
    const baseEpicsOfInitiative = (issuesMappedByParentKey.value[initiative["Issue key"]] || []);
    
    // get timing information of each epic
    const timedEpics = baseEpicsOfInitiative.map((e) => {
        return getEpicTiming(e, issuesMappedByParentKey)
    });
    return timedEpics;
}

// MUST GO "one" more change backwards ...



export async function timing(baseIssues, priorTime, showPartnerReview) {
    const observableBaseIssues = baseIssues.map( issue => new ObservableObject(issue) );

    const issuesMappedByParentKey = value.returnedBy( ()=> getIssuesMappedByParentKey(observableBaseIssues) );

    const initiativesToShow = getInitiativesToShow(observableBaseIssues);

    const initiativeTimingObservables = initiativesToShow.map((initiative)=>{
        return value.returnedBy( ()=> getTimingForInitiative(initiative, issuesMappedByParentKey ) )
    })

    function updateTimings(arg){
        //console.log("update", arg)
    }
    
    initiativeTimingObservables.forEach( (obs)=>{
        obs.on(updateTimings);
        console.log(obs.value);
    } )
    
    await applyChangelogs(observableBaseIssues, priorTime);



}*/