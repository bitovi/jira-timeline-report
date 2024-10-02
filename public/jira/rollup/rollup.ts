import type { DerivedIssue } from "../derived/derive";

import type { DerivedRelease } from "../releases/derive";

export type IssueOrRelease<T = any> = (DerivedIssue & T) | (DerivedRelease & T);
interface ReportingHierarchy {
  depth: number;
  childKeys: string[];
  parentKeys: string[];
}

type ReportingHierarchyIssueOrRelease<T> = IssueOrRelease<T> & {
  reportingHierarchy: ReportingHierarchy;
};

export type RollupData<D> = Record<string, D>;
export type RollupMetadata<M> = Record<string, M>;

export interface RollupResponseItem<D, M> {
  metadata: RollupMetadata<M>;
  rollupData: RollupData<D>[];
}
export type RollupResponse<D, M> = RollupResponseItem<D, M>[];

export type CreateMetadataForHierarchyLevel<M> = (
  hierarchyLevel: number,
  reportingHierarchyIssuesOrReleases: ReportingHierarchyIssueOrRelease<any>[]
) => RollupMetadata<M>;

export type CreateRollupDataFromParentAndChild<D, M, T> = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<T>,
  children: RollupData<D>[],
  hierarchyLevel: number,
  metadata: RollupMetadata<M>
) => RollupData<D>;

export type CreateSingleNodeRollupData<D, M> = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<any>,
  hierarchyLevel: number,
  metadata: RollupMetadata<M>
) => RollupData<D>;

export type FinalizeMetadataForHierarchyLevel<D, M> = (
  metadata: RollupMetadata<M>,
  rollupData: RollupData<D>[]
) => void;

export type GetChildren = (
  reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<any>
) => IssueOrRelease[];

interface RollupGroupedHierarchyOptions<D, M, T = any> {
  createMetadataForHierarchyLevel?: CreateMetadataForHierarchyLevel<M>;
  createSingleNodeRollupData?: CreateSingleNodeRollupData<D, M>;
  createRollupDataFromParentAndChild?: CreateRollupDataFromParentAndChild<
    D,
    M,
    T
  >;
  finalizeMetadataForHierarchyLevel?: FinalizeMetadataForHierarchyLevel<D, M>;
  getChildren?: GetChildren;
}
/**
 * Type guard to determine if IssueOrRelease is DerivedIssue
 * @param {IssueOrRelease} issueOrRelease
 * @returns {issueOrRelease is DerivedIssue}
 */
function isDerivedIssue(
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
export function groupIssuesByHierarchyLevelOrType(
  issuesOrReleases: IssueOrRelease[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel: number }>
): IssueOrRelease[][] {
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
export function addChildrenFromGroupedHierarchy(
  groupedHierarchy: IssueOrRelease[][]
): ReportingHierarchyIssueOrRelease<any>[][] {
  // we should label each issue with its virtual hierarchy ... then we can make sure
  // children add themselves to the right parents ... we can probably do this in one pass as things are ordered
  // {PARENT_KEY: {allChildren: [issues..], index}}
  const parentKeyToChildren: Record<string, ReportingHierarchy> = {};
  const topDownGroups = [...groupedHierarchy].reverse();
  const newGroups: ReportingHierarchyIssueOrRelease<any>[][] = [];
  for (let g = 0; g < topDownGroups.length; g++) {
    let group = topDownGroups[g];
    let newGroup: ReportingHierarchyIssueOrRelease<any>[] = [];
    newGroups.push(newGroup);

    for (let issue of group) {
      let copy: ReportingHierarchyIssueOrRelease<any> = {
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
export function addReportingHierarchy(
  issuesOrReleases: IssueOrRelease[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel: number }>
): ReportingHierarchyIssueOrRelease<any>[] {
  const groups = groupIssuesByHierarchyLevelOrType(
    issuesOrReleases,
    rollupTypesAndHierarchies
  );
  return addChildrenFromGroupedHierarchy(groups).flat(1);
}

/**
 * @param {ReportingHierarchyIssueOrRelease[][]} groupedHierarchy
 * @returns {(keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease) => IssueOrRelease[]}
 */
export function makeGetChildrenFromGrouped(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<any>[][]
): (
  keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<any>
) => IssueOrRelease[] {
  const keyToIssue = new Map<string, ReportingHierarchyIssueOrRelease<any>>();
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
  return function getChildren(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<any>
  ): IssueOrRelease[] {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map(getIssue)
      .filter((issue: IssueOrRelease) => issue !== undefined);
  };
}

/**
 *
 * @param {ReportingHierarchyIssueOrRelease[][]} groupedHierarchy
 * @param {RollupGroupedHierarchyOptions} options
 * @returns {RollupResponse}
 */
export function rollupGroupedReportingHierarchy<D, M>(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<any>[][],
  options: RollupGroupedHierarchyOptions<D, M>
): RollupResponse<D, M> {
  // We should add proper defaults here
  let {
    createMetadataForHierarchyLevel = () => ({}),
    createSingleNodeRollupData,
    createRollupDataFromParentAndChild = () => ({}),
    finalizeMetadataForHierarchyLevel = () => {},
    getChildren,
  } = options;

  // we can build this ourselves if needed ... but costs memory.  Nice if we don't have to do this.
  if (!getChildren) {
    getChildren = makeGetChildrenFromGrouped(groupedHierarchy);
  }
  const rollupDataByKey: Record<string, RollupData<D>> = {};
  function getChildrenRollupData(
    issue: ReportingHierarchyIssueOrRelease<any>
  ): RollupData<D>[] {
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

  const rollupResponseData: RollupResponse<D, M> = [];

  for (
    let hierarchyLevel = 0;
    hierarchyLevel < groupedHierarchy.length;
    hierarchyLevel++
  ) {
    let issues = groupedHierarchy[hierarchyLevel];

    if (!issues) {
      continue;
    }

    let hierarchyData: RollupResponseItem<D, M> = (rollupResponseData[
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
export function rollupGroupedHierarchy<T, D, M>(
  groupedHierarchy: IssueOrRelease<T>[][],
  options: RollupGroupedHierarchyOptions<D, M, T>
): RollupResponse<D, M> {
  // we add this children thing (which is dumb) to handle knowing what
  // a release's children are ...
  // there are probably better ways of doing this without having to
  // calculate it every time
  const reportingHierarchy = addChildrenFromGroupedHierarchy(groupedHierarchy);
  console.log("reportingHierarch", reportingHierarchy);
  return rollupGroupedReportingHierarchy(reportingHierarchy, options);
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
export function makeGetChildrenFromReportingIssues(
  issuesOrReleases: ReportingHierarchyIssueOrRelease<any>[]
): (
  keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<any>
) => ReportingHierarchyIssueOrRelease<any>[] {
  const keyToIssue = new Map<string, ReportingHierarchyIssueOrRelease<any>>();
  for (let issue of issuesOrReleases) {
    keyToIssue.set(issue.key, issue);
  }

  const getIssue = keyToIssue.get.bind(keyToIssue);
  /**
   * @param {ReportingHierarchyIssueOrRelease} keyOrIssueOrRelease
   * @return {ReportingHierarchyIssueOrRelease[]}
   */
  return function getChildren(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<any>
  ): ReportingHierarchyIssueOrRelease<any>[] {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map(getIssue)
      .filter((issue: IssueOrRelease) => issue !== undefined);
  };
}

/**
 *
 * @param {IssueOrRelease[][]} groupedHierarchy
 * @param {RollupResponse} rollupDatas
 * @param {string} key
 * @returns {IssueOrRelease[][]}
 */
export function zipRollupDataOntoGroupedData<D, M>(
  groupedHierarchy: IssueOrRelease[][],
  rollupDatas: RollupResponse<D, M>,
  key: string
): IssueOrRelease[][] {
  const newGroups: IssueOrRelease[][] = [];
  for (let g = 0; g < groupedHierarchy.length; g++) {
    let group = groupedHierarchy[g];
    let newIssues: IssueOrRelease[] = [];
    newGroups.push(newIssues);
    for (let i = 0; i < group.length; i++) {
      let issue = group[i];
      let clone: IssueOrRelease = {
        ...issue,
        [key]: rollupDatas[g].rollupData[i],
      };
      newIssues.push(clone);
    }
  }
  return newGroups;
}
