import React, { FC, useState } from "react";

import { calculateReportStatuses } from "../../../jira/rolledup/work-status/work-status";
import type { DerivedIssue } from "../../../jira/derived/derive";
import type { WithPercentComplete } from "../../../jira/rollup/percent-complete/percent-complete";
import type { WithReportingHierarchy } from "../../../jira/rollup/rollup";

import { makeGetChildrenFromReportingIssues } from "../../../jira/rollup/rollup";

//type EverythingIssues = Parameters<typeof makeGetChildrenFromReportingIssues>[0]
//type EverythingIssue = EverythingIssues[number];

type EverythingIssue =  ReturnType<typeof calculateReportStatuses>[number] &
  DerivedIssue &
  WithPercentComplete & WithReportingHierarchy;

interface GroupProps {
    primaryIssues: EverythingIssue[],
    allIssues: EverythingIssue[],
    baselineDateTime: Date
}

// group to each level of the hierarchy

interface GetParent {
    (issue: EverythingIssue): EverythingIssue | null
}
interface GetChildren {
    (issue: EverythingIssue): EverythingIssue[]
}

type JSONValue = 
  | string 
  | number 
  | boolean 
  | null 
  | JSONValue[] 
  | { [key: string]: JSONValue };

interface BucketGetter {
    (issue: EverythingIssue, 
        {getParent, getChildren} : {getParent: GetParent, getChildren: GetChildren}): JSONValue
}


function ancestorBuckets(issue: EverythingIssue, 
    {getParent, getChildren} : {getParent: GetParent, getChildren: GetChildren}){
    let parent;
    const parentIds : String[] = [] ;
    while(parent = getParent(issue)) {
        parentIds.push(parent.key)
    }
    return parentIds.map((key) => {
        return {ancestor: key}
    });
}
function initiativeBucket(issue: EverythingIssue, 
    {getParent, getChildren} : {getParent: GetParent, getChildren: GetChildren}){
    if(issue.hierarchyLevel === 0) {
        let parent;
        while(parent = getParent(issue)) {
            if(parent.hierarchyLevel === 2) {
                return {initiative: parent.key}
            }
        }
        return null;
    } else {
        return null;
    }
}
function teamBuckets(issue: EverythingIssue){
    return [{team: issue?.team.name}]
}
function teamBucket(issue: EverythingIssue){
    return {team: issue?.team.name}
}

function arrayToMap(
    items: EverythingIssue[]
  ): Record<string, EverythingIssue> {
    const result = {} as Record<string, EverythingIssue>;
    
    for (const item of items) {
      result[item.key] = item;
    }
    
    return result;
  }

/**
 * This function can put single issues into multiple groups
 * This is because of the nature of wanting to make an issue count toward multiple points in the
 * hierarchy
 * 
 * {"{initiative: 1, team: 'foo'}": [ .... ]}
 */
function groupIssuesIntoBuckets(allIssues: EverythingIssue[], bucketGetters: BucketGetter[]) {
    const keyToIssue = arrayToMap(allIssues);
    const getChildren = makeGetChildrenFromReportingIssues(allIssues);
    
    function getParent(issue: EverythingIssue) {
        if(issue?.parentKey) {
            return keyToIssue[issue.parentKey];
        } else {
            return null;
        }
    }

    return Object.groupBy(allIssues, (issue) => {
        
        const dimensions = bucketGetters.map( (bucketGetter) => {
            //@ts-expect-error
            return bucketGetter(issue, {getParent, getChildren})
        });
        const objectKey = Object.assign({}, ...dimensions);

        return JSON.stringify(objectKey);
    });
}
type GroupedIssues = ReturnType<typeof groupIssuesIntoBuckets>

interface Calculation {
    (issues: EverythingIssue[]) : JSONValue
}

function performCalculations(calculations: Record<string, Calculation>, issues: EverythingIssue[]): Record<string, JSONValue> {
    const calcs = {} as Record<string, JSONValue>;
    for(let prop in calculations) {
        calcs[prop] = calculations[prop](issues)
    }
    return calcs;
}
// somehow, I wish type information could flow inside the JSON strings ...


function aggregateRecords(buckets: GroupedIssues, calculations: Record<string, Calculation>){
    return Object.entries(buckets).map(([key, rows]) => {

        const groupKeys = JSON.parse(key); // reconstruct the keys clearly
        if(groupKeys && rows) {
            return {
                ...groupKeys,
                ...performCalculations(calculations, rows)
            };
        }
      }).filter( x => x);
}

/**
 * bucketGetters =  [ () => {return {[BUCKET_KEY]: BUCKET_VALUE }} , ...]
 * calculations -> { [CALCULATION_KEY]: ()=> CALCULATION_VALUE, ....}
 * [{initiative: 1, team: 'foo', count: 6}, {}]
 * [ {BUCKET_KEY: BUCKET_VALUE, CALCULATION_KEY: CALCULATION_VALUE }]
 */

function groupAndAggregate(allIssues: EverythingIssue[], bucketGetters: BucketGetter[], calculations: Record<string, Calculation> ){
    const buckets = groupIssuesIntoBuckets(allIssues, bucketGetters);
    return aggregateRecords(buckets, calculations)
}

function aggregateStoryCountByTeamAndInitiative(allIssues: EverythingIssue[]) {
    const buckets = groupIssuesIntoBuckets(allIssues, [initiativeBucket, teamBucket]);
    const records = aggregateRecords(buckets, {
        count: (issues) => issues.length
    });

    return records;
}


const GroupReport: FC<GroupProps> = ({primaryIssues, allIssues}) => {


    return <h1>Hello There {primaryIssues.length}</h1>
}

export default GroupReport;