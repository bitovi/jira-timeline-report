/**
 * This module provides utilities for building and processing reporting hierarchies of derived issues and releases.
 * It includes functions to group issues by hierarchy levels or types, build parent-child relationships,
 * and perform rollup calculations. The rollup functions enable aggregating data from child issues up through
 * the hierarchy, allowing for customized data summaries and metadata generation at each hierarchy level.
 */
import type { DerivedIssue } from "../derived/derive";

import type { DerivedRelease } from "../releases/derive";

export type IssueOrRelease<CustomFields = unknown> =
  | (DerivedIssue & CustomFields)
  | (DerivedRelease & CustomFields);

interface ReportingHierarchy {
  depth: number;
  childKeys: string[];
  parentKeys: string[];
}

export type ReportingHierarchyIssueOrRelease<CustomFields> =
  IssueOrRelease<CustomFields> & {
    reportingHierarchy: ReportingHierarchy;
  };

export interface RollupResponseItem<Data, Meta> {
  metadata: Meta;
  rollupData: Data[];
}
export type RollupResponse<Data, Meta> = RollupResponseItem<Data, Meta>[];

export type CreateMetadataForHierarchyLevel<CustomFields, Meta> = (
  hierarchyLevel: number,
  reportingHierarchyIssuesOrReleases: ReportingHierarchyIssueOrRelease<CustomFields>[]
) => Meta;

export type CreateRollupDataFromParentAndChild<CustomFields, Data, Meta> = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>,
  children: Data[],
  hierarchyLevel: number,
  metadata: Meta
) => Data;

export type CreateSingleNodeRollupData<CustomFields, Data, Meta> = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>,
  hierarchyLevel: number,
  metadata: Meta
) => Data;

export type FinalizeMetadataForHierarchyLevel<Data, Meta> = (
  metadata: Meta,
  rollupData: Data[]
) => void;

export type GetChildren<CustomFields> = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>
) => IssueOrRelease<CustomFields>[];

interface RollupGroupedHierarchyOptions<CustomFields, Data, Meta> {
  createMetadataForHierarchyLevel?: CreateMetadataForHierarchyLevel<
    CustomFields,
    Meta
  >;
  createSingleNodeRollupData?: CreateSingleNodeRollupData<
    CustomFields,
    Data,
    Meta
  >;
  createRollupDataFromParentAndChild?: CreateRollupDataFromParentAndChild<
    CustomFields,
    Data,
    Meta
  >;
  finalizeMetadataForHierarchyLevel?: FinalizeMetadataForHierarchyLevel<
    Data,
    Meta
  >;
  getChildren?: GetChildren<CustomFields>;
}
/**
 * Type guard to determine if IssueOrRelease is DerivedIssue
 * @param {IssueOrRelease} issueOrRelease
 * @returns {issueOrRelease is DerivedIssue}
 */
export function isDerivedIssue(
  issueOrRelease: IssueOrRelease
): issueOrRelease is DerivedIssue {
  return issueOrRelease.type !== "Release";
}

// =======================
// Now define how one would get the parents from these items
/**
 * Gets the parent's from some issue type. We probably need some way types can provide this.
 * @param {IssueOrRelease} issueOrRelease
 * @returns {string[]}
 */
export function getParentKeys(issueOrRelease: IssueOrRelease): string[] {
  const parents: string[] = [];
  if (isDerivedIssue(issueOrRelease)) {
    if (issueOrRelease.parentKey) {
      parents.push(issueOrRelease.parentKey);
    }
    if (issueOrRelease.releases) {
      parents.push(...issueOrRelease.releases.map((release) => release.key));
    }
  }
  return parents;
}

// =======================
// Now need some way of building the hierarchy from the reporting topology

/**
 * @param {{type: string, hierarchyLevel?: number}}
 * @returns {(issue: IssueOrRelease) => boolean}
 */
function getHierarchyTest({
  type,
  hierarchyLevel,
}: {
  type: string;
  hierarchyLevel?: number;
}): (issue: IssueOrRelease) => boolean {
  if (hierarchyLevel == null || hierarchyLevel === Infinity) {
    return (issue: IssueOrRelease) => {
      return issue.type === type;
    };
  } else {
    return (issue: IssueOrRelease) => {
      return isDerivedIssue(issue) && issue.hierarchyLevel === hierarchyLevel;
    };
  }
}

/**
 *
 * @param {IssueOrRelease[]} issuesOrReleases
 * @param {{type: string, hierarchyLevel: number}[]} rollupTypesAndHierarchies
 * @returns {IssueOrRelease[][]}
 */
export function groupIssuesByHierarchyLevelOrType<CustomFields>(
  issuesOrReleases: IssueOrRelease<CustomFields>[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel?: number }>
): IssueOrRelease<CustomFields>[][] {
  return rollupTypesAndHierarchies
    .map((hierarchy) => {
      return issuesOrReleases.filter(getHierarchyTest(hierarchy));
    })
    .reverse();
}

// ====================
// With that Reporting topology, we are able to build a new mapping of parent / child relationships
// These objects are what the functions should be using to rollup and such

/**
 * Takes a bottom-up grouped hierarchy and adds
 * reportingHierarchy = {childKeys: [keys], parentKeys: [keys], depth: number}}
 * to each issue.
 *
 * Returns a new bottom-up grouped hierarchy of issues or releases
 * @param {IssueOrRelease[][]} groupedHierarchy
 * @returns {ReportingHierarchyIssueOrRelease[][]}
 */
export function addChildrenFromGroupedHierarchy<CustomFields>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][]
): ReportingHierarchyIssueOrRelease<CustomFields>[][] {
  // we should label each issue with its virtual hierarchy ... then we can make sure
  // children add themselves to the right parents ... we can probably do this in one pass as things are ordered
  // {PARENT_KEY: {allChildren: [issues..], index}}
  const parentKeyToChildren: Record<string, ReportingHierarchy> = {};
  const topDownGroups = [...groupedHierarchy].reverse();
  const newGroups: ReportingHierarchyIssueOrRelease<CustomFields>[][] = [];
  for (let g = 0; g < topDownGroups.length; g++) {
    let group = topDownGroups[g];
    let newGroup: ReportingHierarchyIssueOrRelease<CustomFields>[] = [];
    newGroups.push(newGroup);

    for (let issue of group) {
      let copy: ReportingHierarchyIssueOrRelease<CustomFields> = {
        ...issue,
        reportingHierarchy: { depth: g, childKeys: [], parentKeys: [] },
      };
      newGroup.push(copy);
      parentKeyToChildren[issue.key] = copy.reportingHierarchy;
      if (g > 0) {
        const parents = getParentKeys(issue);
        for (let parentKey of parents) {
          const parentData = parentKeyToChildren[parentKey];
          // make sure your parent is up one level in the issue hierarchy
          if (parentData && parentData.depth === g - 1) {
            parentData.childKeys.push(issue.key);
            copy.reportingHierarchy.parentKeys.push(parentKey);
          } else {
            //console.log(issue.type, "has a parent of ", parentKey, parentData.type, "but it's not going to be included", g, parentData.index, issue)
          }
        }
      }
    }
  }
  return newGroups.reverse();
}

/**
 *
 * @param {IssueOrRelease[]} issuesOrReleases
 * @param {{type: string, hierarchyLevel: number}[]} rollupTypesAndHierarchies
 * @returns {ReportingHierarchyIssueOrRelease[]}
 */
export function addReportingHierarchy<CustomFields>(
  issuesOrReleases: IssueOrRelease<CustomFields>[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel: number }>
): ReportingHierarchyIssueOrRelease<CustomFields>[] {
  const groups = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTypesAndHierarchies
  );
  return addChildrenFromGroupedHierarchy<CustomFields>(groups).flat(1);
}

/**
 * @param {ReportingHierarchyIssueOrRelease[][]} groupedHierarchy
 * @returns {(keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease) => IssueOrRelease[]}
 */
export function makeGetChildrenFromGrouped<CustomFields>(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<CustomFields>[][]
): (
  keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>
) => IssueOrRelease<CustomFields>[] {
  const keyToIssue = new Map<
    string,
    ReportingHierarchyIssueOrRelease<CustomFields>
  >();
  for (let group of groupedHierarchy) {
    for (let issue of group) {
      keyToIssue.set(issue.key, issue);
    }
  }
  const getIssue = keyToIssue.get.bind(keyToIssue);
  /**
   * @param {ReportingHierarchyIssueOrRelease} keyOrIssueOrRelease
   * @return {IssueOrRelease[][]}
   */
  return function getChildren<CustomFields>(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>
  ) {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map(getIssue)
      .filter((issue) => issue !== undefined);
  };
}

/**
 *
 * @param {ReportingHierarchyIssueOrRelease[][]} groupedHierarchy
 * @param {RollupGroupedHierarchyOptions} options
 * @returns {RollupResponse}
 */
export function rollupGroupedReportingHierarchy<CustomFields, Data, Meta>(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<CustomFields>[][],
  options: RollupGroupedHierarchyOptions<CustomFields, Data, Meta>
): RollupResponse<Data, Meta> {
  // We should add proper defaults here
  let {
    createMetadataForHierarchyLevel = () => ({} as Meta),
    createSingleNodeRollupData,
    createRollupDataFromParentAndChild = () => ({} as Data),
    finalizeMetadataForHierarchyLevel = () => {},
    getChildren,
  } = options;

  // we can build this ourselves if needed ... but costs memory.  Nice if we don't have to do this.
  if (!getChildren) {
    getChildren = makeGetChildrenFromGrouped<CustomFields>(groupedHierarchy);
  }
  const rollupDataByKey: Record<string, Data> = {};
  function getChildrenRollupData(
    issue: ReportingHierarchyIssueOrRelease<CustomFields>
  ): Data[] {
    return getChildren!(issue).map((childIssue) => {
      const result = rollupDataByKey[childIssue.key];
      if (!result) {
        throw new Error(
          "unable to find previously calculated child data (" +
            childIssue.key +
            "). Is your hierarchy in the right order?"
        );
      }
      return result;
    });
  }

  const rollupResponseData: RollupResponse<Data, Meta> = [];

  for (
    let hierarchyLevel = 0;
    hierarchyLevel < groupedHierarchy.length;
    hierarchyLevel++
  ) {
    let issues = groupedHierarchy[hierarchyLevel];

    if (!issues) {
      continue;
    }

    let hierarchyData: RollupResponseItem<Data, Meta> = (rollupResponseData[
      hierarchyLevel
    ] = {
      rollupData: [],
      metadata: createMetadataForHierarchyLevel(hierarchyLevel, issues),
    });

    for (let issue of issues) {
      // get children rollup data for issue
      let children = getChildrenRollupData(issue);
      let rollupData = createRollupDataFromParentAndChild(
        issue,
        children,
        hierarchyLevel,
        hierarchyData.metadata
      );
      hierarchyData.rollupData.push(rollupData);
      rollupDataByKey[issue.key] = rollupData;
      // associate it with the issue
    }

    //onEndOfHierarchy(issueTypeData);
    finalizeMetadataForHierarchyLevel(
      hierarchyData.metadata,
      hierarchyData.rollupData
    );
  }
  return rollupResponseData;
}
/**
 * This "MUST" have the deepest children in the bottom
 * @param {IssueOrRelease[][]} groupedHierarchy
 * @param {RollupGroupedHierarchyOptions} options
 * @returns {RollupResponse}
 */
export function rollupGroupedHierarchy<CustomFields, Data, Meta = undefined>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][],
  options: RollupGroupedHierarchyOptions<CustomFields, Data, Meta>
): RollupResponse<Data, Meta> {
  // we add this children thing (which is dumb) to handle knowing what
  // a release's children are ...
  // there are probably better ways of doing this without having to
  // calculate it every time
  const reportingHierarchy =
    addChildrenFromGroupedHierarchy<CustomFields>(groupedHierarchy);
  return rollupGroupedReportingHierarchy<CustomFields, Data, Meta>(
    reportingHierarchy,
    options
  );
}

/**
 * @param {number[]} arr
 * @returns {number}
 */
export function sum(arr: number[]): number {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}
/**
 * @param {number[]} arr
 * @returns {number | undefined}
 */
export function average(arr: number[]): number | undefined {
  return arr.length > 0 ? sum(arr) / arr.length : undefined;
}
/*
 * @param {IssueOrRelease[]} issues
 * @returns {IssueOrRelease[][]}
 */
function groupIssuesByHierarchyLevel(
  issues: IssueOrRelease[]
): IssueOrRelease[][] {
  const sorted = issues; //.sort(sortByIssueHierarchy);
  const group: IssueOrRelease[][] = [];

  for (let issue of issues) {
    if (isDerivedIssue(issue)) {
      if (!group[issue.hierarchyLevel]) {
        group[issue.hierarchyLevel] = [];
      }
      group[issue.hierarchyLevel].push(issue);
    }
  }
  return group;
}

/**
 *
 * @param {ReportingHierarchyIssueOrRelease[]} issuesOrReleases
 * @returns {(keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease) => ReportingHierarchyIssueOrRelease[]}
 */
export function makeGetChildrenFromReportingIssues<CustomFields>(
  issuesOrReleases: ReportingHierarchyIssueOrRelease<CustomFields>[]
): (
  keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>
) => ReportingHierarchyIssueOrRelease<CustomFields>[] {
  const keyToIssue = new Map<
    string,
    ReportingHierarchyIssueOrRelease<CustomFields>
  >();
  for (let issue of issuesOrReleases) {
    keyToIssue.set(issue.key, issue);
  }

  const getIssue = keyToIssue.get.bind(keyToIssue);
  /**
   * @param {ReportingHierarchyIssueOrRelease} keyOrIssueOrRelease
   * @return {ReportingHierarchyIssueOrRelease[]}
   */
  return function getChildren(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<CustomFields>
  ): ReportingHierarchyIssueOrRelease<CustomFields>[] {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map(getIssue)
      .filter((issue) => issue !== undefined);
  };
}

/**
 *
 * @param {IssueOrRelease[][]} groupedHierarchy
 * @param {RollupResponse} rollupDatas
 * @param {string} key
 * @returns {IssueOrRelease[][]}
 */
export function zipRollupDataOntoGroupedData<CustomFields, Data, Meta>(
  groupedHierarchy: IssueOrRelease<CustomFields>[][],
  rollupDatas: RollupResponse<Data, Meta>,
  key: string
): IssueOrRelease<CustomFields>[][] {
  const newGroups: IssueOrRelease<CustomFields>[][] = [];
  for (let g = 0; g < groupedHierarchy.length; g++) {
    let group = groupedHierarchy[g];
    let newIssues: IssueOrRelease<CustomFields>[] = [];
    newGroups.push(newIssues);
    for (let i = 0; i < group.length; i++) {
      let issue = group[i];
      let clone: IssueOrRelease<CustomFields> = {
        ...issue,
        [key]: rollupDatas[g].rollupData[i],
      };
      newIssues.push(clone);
    }
  }
  return newGroups;
}
