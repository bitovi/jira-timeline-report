import type { DerivedIssue } from "../../../../jira/derived/derive";

import {partition, indexByKey, groupBy} from "../../../../utils/array/array-helpers";
import {getEstimationData} from "../../../../jira/derived/work-timing/work-timing"

type Mutable<T> = {
    -readonly [P in keyof T]: T[P] extends ReadonlyArray<infer U>
      ? MutableArray<U>
      : T[P] extends object
        ? Mutable<T[P]>
        : T[P];
  };
type MutableArray<T> = Array<Mutable<T>>;

type LinkedIssueBuilder = Mutable<LinkedIssue>;

export type LinkedIssue = DerivedIssue & {
    readonly linkedChildren: LinkedIssue[];
    readonly linkedParent: LinkedIssue | null;
    readonly linkedBlocks: LinkedIssue[];
    readonly linkedBlockedBy: LinkedIssue[];
    readonly blocksWorkDepth: number;
    readonly mutableWorkItem: {
        daysOfWork: number;
        startDay: number | null;
        artificiallyDelayed?: boolean;
        track?: number;
    }
}
type LinkedIssueBuilderIndex = Record<string, LinkedIssueBuilder>
type LinkedIssueIndex = Record<string,LinkedIssue >;

export function linkIssues(issues: DerivedIssue[], probablisticallySelectIssueTiming: boolean) : LinkedIssue[] {

    const clones = issues.map( (issue) => {
        return {
            linkedChildren: [],
            linkedParent: null,
            linkedBlocks: [],
            linkedBlockedBy: [],
            blocksWorkDepth: 0,
            mutableWorkItem: {
                daysOfWork: issue.derivedTiming.deterministicTotalDaysOfWork,
                startDay: null
            },
            //daysOfWork: 
            ...issue
        };
    }) as LinkedIssueBuilder[];

    const issueByKey = indexByKey(clones, "key");

    linkParentAndChildren(clones, issueByKey);
    linkDirectBlocks(clones,issueByKey );

    clones.forEach( setBlocksWorkDepthDeterministically );
    clones.sort((iA, iB) => iB.blocksWorkDepth - iA.blocksWorkDepth);

    return clones as LinkedIssue[];
}

export function resetLinkedIssue(issue: LinkedIssue){
    issue.mutableWorkItem.artificiallyDelayed = undefined;
    issue.mutableWorkItem.startDay = null;
    issue.mutableWorkItem.daysOfWork = getEstimationData(issue,{}).probablisticTotalDaysOfWork;
}


function setBlocksWorkDepthDeterministically(issue: LinkedIssueBuilder):number {
    if(issue.blocksWorkDepth !== undefined) {
        return issue.blocksWorkDepth;
    }
    if( !issue.linkedBlocks.length) {
        return issue.blocksWorkDepth = issue.derivedTiming.deterministicTotalDaysOfWork;
    } else {
        return issue.blocksWorkDepth = issue.derivedTiming.deterministicTotalDaysOfWork + issue.linkedBlocks.reduce( (max, issue)=> {
            return Math.max(max,  setBlocksWorkDepthDeterministically(issue) );
        },0)
    }
}



function linkParentAndChildren(issues: LinkedIssueBuilder[], issueByKey: LinkedIssueBuilderIndex) {

    const issuesByParentKey = groupBy(issues, issue => issue.parentKey || "");
  
    for(let parentKey in issuesByParentKey) {
      if(parentKey) {
        const issue = issueByKey[parentKey];
        const children = issuesByParentKey[parentKey];
        if(issue) {
          issue.linkedChildren = children;
          //@ts-ignore
          children.forEach( child => child.linkedParent = issue );
        } else {
          //console.log("Unable to find epic", epicKey, "perhaps it is marked as done but has an issue not done");
        }
      }
    }
}

function getBlockingKeys(issue: LinkedIssueBuilder){
    const linkedIssues = issue.issue.fields["Linked Issues"]
    if(linkedIssues) {
        return linkedIssues.filter( link => link.type.name === "Blocks" && link.outwardIssue)
            .map( link => link.outwardIssue.key)
    } else {
        return []
    }
  }

function linkDirectBlocks(issues: LinkedIssueBuilder[], issueByKey: LinkedIssueBuilderIndex){
    issues.forEach((issue)=> {
      const issueBlocks = getBlockingKeys(issue).filter(blockedKey => {
        const blocked = issueByKey[blockedKey];
        if(blocked && blocked.type !== issue.type) {
            console.log(issue.type, issue.summary,"is blocking", blocked.type, blocked.summary, ". This is ignored");
            return false;
        } else {
            return true;
        }
      })
      .map( (blockKey)=> {
          return issueByKey[blockKey];
      })
      // we might want to warn about missing blocked issues
      .filter( (blockedIssue) => blockedIssue );
  
      issue.linkedBlocks = issueBlocks;
  
      issue.linkedBlocks.forEach( (blocker)=> {
          blocker.linkedBlockedBy.push(issue);
      })
    });
  }