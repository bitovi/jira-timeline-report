/**
 * This module provides utilities for building and processing reporting hierarchies of derived issues and releases.
 * It includes functions to group issues by hierarchy levels or types, build parent-child relationships,
 * and perform rollup calculations. The rollup functions enable aggregating data from child issues up through
 * the hierarchy, allowing for customized data summaries and metadata generation at each hierarchy level.
 */
import type { DerivedIssue } from "../derived/derive";

import type { DerivedRelease } from "../releases/derive";

// type GetInnerType<S> = S extends IssueOrRelease<infer T> ? T : never;

export type IssueOrRelease<CustomFields = unknown> = (DerivedIssue | DerivedRelease) & CustomFields;

interface ReportingHierarchy {
  depth: number;
  childKeys: string[];
  parentKeys: string[];
}

export type WithReportingHierarchy = {
  reportingHierarchy: ReportingHierarchy;
};

export type CustomFieldsOf<T> = Omit<
  T,
  "reportingHierarchy" | keyof IssueOrRelease
>;

export type ReportingHierarchyIssueOrRelease<T extends IssueOrRelease> = T & WithReportingHierarchy;

export type RollupGroupedHierarchyOptions<
  TRollupable extends IssueOrRelease,
  TMetadata extends Record<string, any>,
  TRollupValues
> = Partial<{
  createMetadataForHierarchyLevel: (hierarchyLevel: number, issues: TRollupable[]) => TMetadata;
  createRollupDataFromParentAndChild: (
    parent: TRollupable,
    childrenRollupValues: TRollupValues[],
    hierarchyLevel: number,
    metadata: TMetadata
  ) => TRollupValues;
  finalizeMetadataForHierarchyLevel: (metadata: TMetadata, rollupData: TRollupValues[]) => void;
  getChildren: (
    reportingHierarchyIssueOrRelease: ReportingHierarchyIssueOrRelease<TRollupable>
  ) => TRollupable[];
}>;

export type RollupResponse<TMetadata extends Record<string, any>, TRollupValues> = {
  metadata: TMetadata;
  rollupData: TRollupValues[];
}[];

/**
 * Type guard to determine if IssueOrRelease is DerivedRelease
 * @param issueOrRelease
 * @returns
 */
export function isDerivedRelease<T extends IssueOrRelease>(
  issueOrRelease: T
): issueOrRelease is Exclude<T, DerivedIssue> {
  return issueOrRelease.type === "Release";
}

/**
 * Type guard to determine if IssueOrRelease is DerivedIssue
 * @param issueOrRelease
 * @returns
 */
export function isDerivedIssue<T extends IssueOrRelease>(
  issueOrRelease: T
): issueOrRelease is Exclude<T, DerivedRelease> {
  return issueOrRelease.type !== "Release";
}

// =======================
// Now define how one would get the parents from these items
/**
 * Gets the parent's from some issue type. We probably need some way types can provide this.
 * @param issueOrRelease
 * @returns
 */
export function getParentKeys(issueOrRelease: IssueOrRelease) {
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

function getHierarchyTest({ type, hierarchyLevel }: { type: string; hierarchyLevel?: number }) {
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

export function groupIssuesByHierarchyLevelOrType<TRollupable extends IssueOrRelease>(
  issuesOrReleases: TRollupable[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel?: number }>
) {
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
 * @param groupedHierarchy a bottom-up grouped hierarchy
 * @returns a new bottom-up grouped hierarchy of issues or releases
 */
export function addChildrenFromGroupedHierarchy<TRollupable extends IssueOrRelease>(
  groupedHierarchy: TRollupable[][]
) {
  // we should label each issue with its virtual hierarchy ... then we can make sure
  // children add themselves to the right parents ... we can probably do this in one pass as things are ordered
  // {PARENT_KEY: {allChildren: [issues..], index}}
  const parentKeyToChildren: Record<string, ReportingHierarchy> = {};
  const topDownGroups = [...groupedHierarchy].reverse();
  const newGroups: ReportingHierarchyIssueOrRelease<TRollupable>[][] = [];
  for (let g = 0; g < topDownGroups.length; g++) {
    let group: IssueOrRelease<TRollupable>[] = topDownGroups[g];
    let newGroup: ReportingHierarchyIssueOrRelease<TRollupable>[] = [];
    newGroups.push(newGroup);

    for (let issue of group) {
      let copy: ReportingHierarchyIssueOrRelease<TRollupable> = {
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

export function addReportingHierarchy(
  issuesOrReleases: IssueOrRelease[],
  rollupTypesAndHierarchies: Array<{ type: string; hierarchyLevel: number }>
) {
  const groups = groupIssuesByHierarchyLevelOrType(issuesOrReleases, rollupTypesAndHierarchies);
  return addChildrenFromGroupedHierarchy(groups).flat(1);
}

export function makeGetChildrenFromGrouped<T extends IssueOrRelease>(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<T>[][]
) {
  const keyToIssue = new Map<string, ReportingHierarchyIssueOrRelease<T>>();
  for (let group of groupedHierarchy) {
    for (let issue of group) {
      keyToIssue.set(issue.key, issue);
    }
  }

  return function getChildren(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<T>
  ) {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map((k) => keyToIssue.get(k))
      .filter((issue) => issue !== undefined);
  };
}

export function rollupGroupedReportingHierarchy<
  TRollupable extends IssueOrRelease,
  TMetadata extends Record<string, any>,
  TRollupValues
>(
  groupedHierarchy: ReportingHierarchyIssueOrRelease<TRollupable>[][],
  options: RollupGroupedHierarchyOptions<TRollupable, TMetadata, TRollupValues>
) {
  // We should add proper defaults here
  const {
    createMetadataForHierarchyLevel = () => ({} as TMetadata),
    createRollupDataFromParentAndChild = () => ({} as TRollupValues),
    finalizeMetadataForHierarchyLevel = () => {},
    getChildren = makeGetChildrenFromGrouped(groupedHierarchy),
  } = options;

  const rollupDataByKey: Record<string, TRollupValues> = {};
  function getChildrenRollupData(
    issue: ReportingHierarchyIssueOrRelease<TRollupable>
  ) {
    return getChildren(issue).map((childIssue) => {
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

  const rollupResponseData: RollupResponse<TMetadata, TRollupValues> = [];

  for (let hierarchyLevel = 0; hierarchyLevel < groupedHierarchy.length; hierarchyLevel++) {
    let issues = groupedHierarchy[hierarchyLevel];

    if (!issues) {
      continue;
    }

    let hierarchyData: {
      metadata: TMetadata;
      rollupData: TRollupValues[];
    } = (rollupResponseData[hierarchyLevel] = {
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
    finalizeMetadataForHierarchyLevel(hierarchyData.metadata, hierarchyData.rollupData);
  }
  return rollupResponseData;
}

/**
 * This "MUST" have the deepest children in the bottom
 * @param groupedHierarchy
 * @param options
 * @returns
 */
export function rollupGroupedHierarchy<
  TRollupable extends IssueOrRelease,
  TMetadata extends Record<string, any>,
  TRollupValues
>(
  groupedHierarchy: TRollupable[][],
  options: RollupGroupedHierarchyOptions<TRollupable, TMetadata, TRollupValues>
) {
  // we add this children thing (which is dumb) to handle knowing what
  // a release's children are ...
  // there are probably better ways of doing this without having to
  // calculate it every time
  const reportingHierarchy = addChildrenFromGroupedHierarchy(groupedHierarchy);
  return rollupGroupedReportingHierarchy<TRollupable, TMetadata, TRollupValues>(
    reportingHierarchy,
    options
  );
}

export function sum(arr: number[]): number {
  return arr.reduce((partialSum, a) => partialSum + a, 0);
}

export function average(arr: number[]): number | undefined {
  return arr.length > 0 ? sum(arr) / arr.length : undefined;
}

export function makeGetChildrenFromReportingIssues<T extends IssueOrRelease>(
  issuesOrReleases: ReportingHierarchyIssueOrRelease<T>[]
) {
  const keyToIssue = new Map<string, ReportingHierarchyIssueOrRelease<T>>();
  for (let issue of issuesOrReleases) {
    keyToIssue.set(issue.key, issue);
  }

  const getIssue = keyToIssue.get.bind(keyToIssue);
  return function getChildren(
    keyOrIssueOrRelease: ReportingHierarchyIssueOrRelease<T>
  ): ReportingHierarchyIssueOrRelease<T>[] {
    return keyOrIssueOrRelease.reportingHierarchy.childKeys
      .map(getIssue)
      .filter((issue) => issue !== undefined);
  };
}

export function zipRollupDataOntoGroupedData<
  TRollupable extends IssueOrRelease,
  TMetadata extends Record<string, any>,
  TRollupValues
>(
  groupedHierarchy: TRollupable[][],
  rollupDatas: RollupResponse<TMetadata, TRollupValues>,
  key: string
) {
  const newGroups: TRollupable[][] = [];
  for (let g = 0; g < groupedHierarchy.length; g++) {
    let group = groupedHierarchy[g];
    let newIssues: TRollupable[] = [];
    newGroups.push(newIssues);
    for (let i = 0; i < group.length; i++) {
      let issue = group[i];
      let clone: TRollupable = {
        ...issue,
        [key]: rollupDatas[g].rollupData[i],
      };
      newIssues.push(clone);
    }
  }
  return newGroups;
}
