import { ObservableObject, value, Reflect } from "../can.js";
import { deriveIssue } from "../jira/derived/derive.js";
import bitoviTrainingData from "../examples/bitovi-training.js";
import { normalizeIssue } from "../jira/normalized/normalize.js";

/*
class IssueData extends ObservableObject {
    static props = {
        jql: saveJSONToUrl("jql", "", String, {parse: x => ""+x, stringify: x => ""+x}),
        isLoggedIn: Boolean,
    }
}*/
const typesToHierarchyLevel = {Epic: 1, Story: 0, Initiative: 2};
export function csvToRawIssues(csvIssues){
    const res = csvIssues.map( (issue)=> {
        return {
          ...issue,
          fields: {
            ...issue,
            "Parent Link": {data: issue["Parent Link"]},
            "Issue Type": {name: issue["Issue Type"], hierarchyLevel: typesToHierarchyLevel[issue["Issue Type"]]},
            "Status": {name: issue.Status}
          },
          key: issue["Issue key"]
        }
    });
    return res;
}

export function rawIssuesRequestData({jql, isLoggedIn, loadChildren, jiraHelpers},{listenTo, resolve}) {
    
    const progressData = value.with(null);
    
    const promise = value.returnedBy(function rawIssuesPromise(){
        if( isLoggedIn.value === false) {
            return bitoviTrainingData(new Date()).then(csvToRawIssues) ;
        }

        if(!jql.value) {
            return undefined;
        }

        progressData.value = null;
    
        const loadIssues = loadChildren.value ? 
            jiraHelpers.fetchAllJiraIssuesAndDeepChildrenWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers) :
            jiraHelpers.fetchAllJiraIssuesWithJQLAndFetchAllChangelogUsingNamedFields.bind(jiraHelpers);
          
        return loadIssues({
              jql: jql.value,
              fields: ["summary",
                  "Rank",
                  "Start date",
                  "Due date",
                  "Issue Type",
                  "Fix versions",
                  "Story points",
                  "Story points median",
                  "Confidence",
                  "Story points confidence",
                  "Product Target Release",  // TODO comment this out ...
                  "Labels", "Status", "Sprint", "Epic Link", "Created","Parent"],
              expand: ["changelog"]
          }, (receivedProgressData)=> {            
            progressData.value = {...receivedProgressData};
          });
    })

    listenTo(promise, (value)=> {
        resolve({
            progressData,
            issuesPromise: value
        })
    });


    resolve({
        progressData,
        issuesPromise: promise.value
    })


}

function resolve(value){
    if(value instanceof Promise) {
        return value;
    } else {
        return Reflect.getValue(value)
    }
}

export function configurationPromise({
    serverInfoPromise, 
    teamConfigurationPromise
}){
    // we will give pending until we have both promises 
    const info = resolve( serverInfoPromise ),
        team = resolve(teamConfigurationPromise);
    if(!info || !team) {
        return new Promise(()=>{})
    }
    return Promise.all([info, team]).then(
        /**
         * 
         * @param {[Object, TeamConfiguration]} param0 
         * @returns 
         */
        ([serverInfo, teamData])=> {
        return {
            getConfidence({fields}){
                return fields.Confidence;
            },
            getStoryPointsMedian({fields}) {
                return fields["Story points median"]
            },
            getUrl({key}){
                return serverInfo.baseUrl+"/browse/"+key
            },
            getVelocity(team) {
                return teamData.getVelocityForTeam(team)
            },
            getDaysPerSprint(team) {
                return teamData.getDaysPerSprintForTeam(team)
            },
            getParallelWorkLimit(team) {
                return teamData.getTracksForTeam(team)
            },
        }
    })
}


export function derivedIssuesRequestData({
    rawIssuesRequestData, 
    configurationPromise
},{listenTo, resolve}) {
    const promise = value.returnedBy(function derivedIssuesPromise(){
        if(rawIssuesRequestData.value.issuesPromise && configurationPromise.value) {
            return Promise.all([
                rawIssuesRequestData.value.issuesPromise,
                configurationPromise.value
            ]).then( ([rawIssues, configuration])=> {
                console.log({rawIssues});
                return rawIssues.map( issue => {
                    const normalized = normalizeIssue(issue,configuration);
                    const derived = deriveIssue(normalized, configuration);
                    return derived;
                });
                

            })
        } else {
            // make a pending promise ...
            const promise = new Promise(()=>{});
            promise.__isAlwaysPending = true;
            return promise;
        }
    })
    listenTo(promise, (derivedIssues)=> {
        resolve({
            issuesPromise: derivedIssues,
            progressData: rawIssuesRequestData.value.progressData
        })
    });
    resolve({
        issuesPromise: promise.value,
        progressData: rawIssuesRequestData.value.progressData
    });
}
