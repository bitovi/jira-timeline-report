import { parseDateISOString } from "../../../date-helpers";

const fieldsSet = new Set();


function getSprintNumbers(value) {
    if(value === "") {
        return null;
    } else {
        return value.split(",").map( num => +num);
    }
}
function getSprintNames(value) {
    if(value === "") {
        return null;
    } else {
        return value.split(",").map( name => name.trim() );
    }
}


export const fields = {

    // from will look like "1619, 1647"
    // we need to update `lastReturnValue` to have 
    // only the right sprints
    Sprint: function(lastReturnValue, change, fieldName, {sprints}) {
        const sprintNumbers = getSprintNumbers( change.from );
        const sprintNames = getSprintNames(change.fromString);
        
        if( sprintNumbers === null ) {
            return {[fieldName]: null};
        } else {

            return {[fieldName]: sprintNumbers.map( (number, i)=>{
                // REMOVE IN PROD
                if(sprints.ids.has(number) ) {
                    return sprints.ids.get(number);
                } else if(sprints.names.has(sprintNames[i])) {
                    return sprints.names.get(sprintNames[i]);
                } else {
                    console.warn("Can't find sprint ", number, sprintNames[i]);
                }
                
            }) }
        }
        
    },
    "Fix versions": function(lastReturnValue, change, fieldName, {versions}) {

        if(change.from) {
            if(versions.ids.has(change.from)) {
                return {[fieldName]: versions.ids.get(change.from)};
            } else if( versions.names.has(change.fromString) ) {
                return {[fieldName]: versions.names.get(change.fromString)};
            } else {
                console.warn("Can't find release version ", change.from, change.fromString);
                return {[fieldName]: lastReturnValue};
            }
        } else {
            return {[fieldName]: []};
        }
    },
    // Parent Link, Epic Link, 
    "IssueParentAssociation": function(lastReturnValue, change) {
        return {Parent: {key: change.toString, id: change.to}}
    },
    "Parent Link": function(lastReturnValue, change) {
        return {Parent: {key: change.toString}};
    },
    "Epic Link": function(lastReturnValue, change) {
        return {Parent: {key: change.toString}};
    },
    "Status": function(lastReturnValue, change, fieldName, {statuses}) {
        if(statuses.ids.has(change.from)) {
            return {[fieldName]: statuses.ids.get(change.from)};
        } else if( statuses.names.has(change.fromString) ) {
            return {[fieldName]: statuses.names.get(change.fromString)};
        } else {
            console.warn("Can't find status", change.from, change.fromString);
            return {[fieldName]: {name: change.fromString}};
        }
    }
}
const fieldAlias = {
    "duedate": "Due date",
    "status": "Status",
    "labels": "Labels",
    "issuetype": "Issue Type",
    // "summary": "Summary" // we don't want to change summary
    "Fix Version": "Fix versions"
}

function getSprintsMapsFromIssues(issues){
    const ids = new Map();
    const names = new Map();
    for(const issue of issues) {
        for(const sprint of (issue.fields.Sprint || [])) {
            ids.set(sprint.id, sprint);
            names.set(sprint.name, sprint);
        }
    }
    return {ids, names};
}

function getVersionsFromIssues(issues){
    const ids = new Map();
    const names = new Map();
    for(const issue of issues) {
        for(const version of (issue.fields["Fix versions"] || [])) {
            ids.set(version.id, version);
            names.set(version.name, version);
        }
    }
    return {ids, names};
}


function getStatusesFromIssues(issues) {
    const ids = new Map();
    const names = new Map();
    for(const issue of issues) {
        
        ids.set(issue.fields.Status.id, issue.fields.Status);
        names.set(issue.fields.Status.name, issue.fields.Status);
        
    }
    return {ids, names};
}

export function rollbackIssues(issues, rollbackTime) {
    const sprints = getSprintsMapsFromIssues(issues);
    const versions = getVersionsFromIssues(issues);
    const statuses = getStatusesFromIssues(issues);
    return issues.map(i => rollbackIssue(i, {sprints, versions, statuses}, rollbackTime)).filter( i => i );
}

const oneHourAgo = new Date(new Date() - 1000*60*60)

/**
 * @typedef {{
 *   rolledBackTo: Date,
 *   didNotExist: Boolen
 * }} RolledBackMetadata
 */

/**
 * @typedef {import("../../normalized/normalize").JiraIssue & {rollbackMetadata: RolledBackMetadata}} RolledBackJiraIssue
 */

/**
 * @param {import("../../normalized/normalize").JiraIssue} issue 
 * @param {*} data 
 * @param {Date} rollbackTime 
 * @returns {RolledBackJiraIssue}
 */
export function rollbackIssue(issue, data, rollbackTime = oneHourAgo) {

    const {changelog, ...copy} = issue;
    copy.rollbackMetadata = {rolledbackTo: rollbackTime};
    // ignore old issues
    if( parseDateISOString(issue.fields.Created) > rollbackTime) {
        return;
        /*
        copy.rollbackMetadata.didNotExist = true;
        delete copy.fields;
        // should convert to date ...
        copy.rollbackMetadata.didNotExistBefore = issue.fields.Created;
        return copy;*/
    }
    // 
    
    copy.fields = {...issue.fields};

    for(const {items, created} of changelog) {
        // we need to go back before ... 
        if( parseDateISOString(created) < rollbackTime) {
            break;
        }
        items.forEach( (change) => {
            const {field, from, to} = change;
            const fieldName = fieldAlias[field] || field;
            if(fields[fieldName]) {

                Object.assign(copy.fields, fields[fieldName](copy[fieldName], change, fieldName, data) );
            } else {
                copy.fields[fieldName] = from;
            }

        })
    }
    return copy;
}

/*
export function collectChangelog(observableBaseIssues, priorTime) {
    const changes = observableBaseIssues.map( baseIssue => {
        return baseIssue.changelog.map( change => {
            return {...change, issue: baseIssue, createdDate: parseDateISOString(change.created) };
        })
    } ).flat().sort( (cl1, cl2) => cl1.createdDate - cl2.createdDate);

    return changes.filter( change => change.createdDate >= priorTime );
}


export function applyChangelog(changes, data) {
    for(const {items, created, issue} of changes) {

        items.forEach( (change) => {
            const {field, from, to} = change;

            if(field in issue) {
                if(fields[field]) {
                    issue[field] = fields[field](issue[field], change, data);
                } else {
                    issue[field] = from;
                }
                
            }
        })
    }
}



function sleep(time) {
    return new Promise(function(resolve){
        if(!time) {
            resolve();
        }
    })
}

const CHANGE_APPLY_AMOUNT = 2000;
export async function applyChangelogs(observableBaseIssues, priorTime) {
    const changes = collectChangelog(observableBaseIssues, priorTime);
    console.log("processing",changes.length, "changes");
    const sprints = getSprintsMapsFromIssues(observableBaseIssues);
    const batches = [];
    
    while(changes.length) {
        await sleep();
        const batch = changes.splice(0, CHANGE_APPLY_AMOUNT);
        applyChangelog(batch, {sprints});
    }
}*/