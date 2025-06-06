import React, { useState, useMemo } from 'react';
import type { StatsUIData, SimulationIssueResult } from './scheduler/stats-analyzer';
import Button from '@atlaskit/button';
import ChevronDownIcon from '@atlaskit/icon/glyph/chevron-down';

interface CriticalPathProps {
  uiData: StatsUIData;
  workItemsToHighlight: Set<string> | null;
  setWorkItemsToHighlight: React.Dispatch<React.SetStateAction<Set<string> | null>>;
}

type CriticalPathResult = {
  workItem: SimulationIssueResult;
  blockedPath: SimulationIssueResult[];
  totalDaysInCriticalPath: number;
  otherBlockedWork: Set<SimulationIssueResult>;
  totalDaysAcrossAllBlockedWork: number;
  include: boolean;
};

function sortWorkItemsByBlocksWorkDepth(wiA: SimulationIssueResult, wiB: SimulationIssueResult) {
  return (wiB.linkedIssue.blocksWorkDepth || 0) - (wiA.linkedIssue.blocksWorkDepth || 0);
}

function recursivelyAddToOtherBlockedWork(
  criticalPath: CriticalPathResult,
  blockedWork: SimulationIssueResult[],
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
) {
  blockedWork.forEach((workItem) => {
    excludedKeys.add(workItem.linkedIssue.key);
    if (!criticalPath.otherBlockedWork.has(workItem)) {
      criticalPath.otherBlockedWork.add(workItem);
      criticalPath.totalDaysAcrossAllBlockedWork += workItem.adjustedDaysOfWork;
      const blockingWorkItems = (workItem.linkedIssue.linkedBlocks || [])
        .map((issue: any) => keyToWorkItem[issue.key])
        .filter(Boolean)
        .sort(sortWorkItemsByBlocksWorkDepth);
      recursivelyAddToOtherBlockedWork(criticalPath, blockingWorkItems, excludedKeys, keyToWorkItem);
    }
  });
}

function recursivelyAddToCriticalPath(
  criticalPath: CriticalPathResult,
  blocked: any[],
  excludedKeys: Set<string>,
  keyToWorkItem: Record<string, SimulationIssueResult>,
) {
  const blockingWorkItems = (blocked || [])
    .map((issue: any) => keyToWorkItem[issue.key])
    .filter(Boolean)
    .sort(sortWorkItemsByBlocksWorkDepth);
  if (blockingWorkItems.length) {
    criticalPath.blockedPath.push(blockingWorkItems[0]);
    excludedKeys.add(blockingWorkItems[0].linkedIssue.key);
    criticalPath.totalDaysInCriticalPath += blockingWorkItems[0].adjustedDaysOfWork;
    criticalPath.totalDaysAcrossAllBlockedWork += blockingWorkItems[0].adjustedDaysOfWork;
    recursivelyAddToCriticalPath(
      criticalPath,
      blockingWorkItems[0].linkedIssue.linkedBlocks,
      excludedKeys,
      keyToWorkItem,
    );
    recursivelyAddToOtherBlockedWork(criticalPath, blockingWorkItems.slice(1), excludedKeys, keyToWorkItem);
  }
}

export const CriticalPath: React.FC<CriticalPathProps> = ({
  uiData,
  workItemsToHighlight,
  setWorkItemsToHighlight,
}) => {
  const [showing, setShowing] = useState(false);

  // Build a map from key to work item for fast lookup
  const keyToWorkItem = useMemo(() => {
    const map: Record<string, SimulationIssueResult> = {};
    uiData.simulationIssueResults.forEach((item) => {
      map[item.linkedIssue.key] = item;
    });
    return map;
  }, [uiData.simulationIssueResults]);

  // Compute critical paths (memoized, only when showing)
  const criticalPaths = useMemo(() => {
    if (!showing) return [];
    const sorted = Object.values(keyToWorkItem).sort(sortWorkItemsByBlocksWorkDepth);
    const excludedKeys = new Set<string>();
    const criticalPaths: (CriticalPathResult & { otherBlockedWorkArr: SimulationIssueResult[] })[] = sorted.map(
      (workItem) => {
        const criticalPath: CriticalPathResult = {
          workItem,
          blockedPath: [],
          totalDaysInCriticalPath: workItem.adjustedDaysOfWork,
          otherBlockedWork: new Set(),
          totalDaysAcrossAllBlockedWork: workItem.adjustedDaysOfWork,
          include: !excludedKeys.has(workItem.linkedIssue.key),
        };
        excludedKeys.add(workItem.linkedIssue.key);
        //debugger
        recursivelyAddToCriticalPath(criticalPath, workItem.linkedIssue.linkedBlocks, excludedKeys, keyToWorkItem);
        return { ...criticalPath, otherBlockedWorkArr: Array.from(criticalPath.otherBlockedWork) };
      },
    );
    return criticalPaths
      .filter((cp) => cp.include)
      .sort((a, b) => b.totalDaysInCriticalPath - a.totalDaysInCriticalPath);
  }, [keyToWorkItem, showing]);

  function toggleText(criticalPath: CriticalPathResult & { otherBlockedWorkArr: SimulationIssueResult[] }) {
    const startingKey = criticalPath.workItem.linkedIssue.key;
    if (workItemsToHighlight && workItemsToHighlight.has(startingKey)) {
      return 'Show all work';
    } else {
      return 'Show critical path and blocked work';
    }
  }

  function shouldShowPath(criticalPath: CriticalPathResult & { otherBlockedWorkArr: SimulationIssueResult[] }) {
    if (!workItemsToHighlight) return true;
    const startingKey = criticalPath.workItem.linkedIssue.key;
    return workItemsToHighlight.has(startingKey);
  }

  function toggleHighlight(
    criticalPath: CriticalPathResult & { otherBlockedWorkArr: SimulationIssueResult[] },
    event: React.MouseEvent,
  ) {
    console.log('Toggling highlight for critical path:', criticalPath);
    const startingKey = criticalPath.workItem.linkedIssue.key;
    if (workItemsToHighlight && workItemsToHighlight.has(startingKey)) {
      setWorkItemsToHighlight(null);
    } else {
      const pathKeys = criticalPath.blockedPath.map((wi) => wi.linkedIssue.key);
      const otherWorkKeys = criticalPath.otherBlockedWorkArr.map((wi) => wi.linkedIssue.key);
      setWorkItemsToHighlight(new Set([startingKey, ...pathKeys, ...otherWorkKeys]));
    }
  }

  return (
    <details
      open={showing}
      onToggle={(e) => setShowing((e.target as HTMLDetailsElement).open)}
      className="bg-white border border-neutral-30 rounded shadow-sm mt-4"
    >
      <summary
        className="flex items-center gap-2 px-4 py-2 cursor-pointer select-none text-base font-semibold text-neutral-800 hover:bg-neutral-20 rounded-t transition-colors"
        style={{ outline: 'none' }}
      >
        <span
          className="flex items-center transition-transform duration-200"
          style={!showing ? { transform: 'rotate(-90deg)' } : {}}
        >
          <ChevronDownIcon label="Expand" size="medium" />
        </span>
        <span>
          <b className="font-bold">Critical Paths</b> - Identify the long poles in your plan.
        </span>
      </summary>
      {showing && (
        <div className="grid gap-2 py-4 px-4" style={{ gridTemplateColumns: 'auto auto auto auto auto' }}>
          <div className="font-bold">First Epic</div>
          <div className="font-bold">Days in Critical Path</div>
          <div className="font-bold">Following Epics in Critical Path</div>
          <div className="font-bold">Days for All blocked work</div>
          <div className="font-bold">Remaining Blocked Epics</div>
          {criticalPaths.map((criticalPath, idx) =>
            shouldShowPath(criticalPath) ? (
              <React.Fragment key={criticalPath.workItem.linkedIssue.key}>
                <div style={{ gridRow: idx + 2, gridColumn: '1 / span 5' }} className="bg-neutral-10"></div>
                <div style={{ gridRow: idx + 2, gridColumn: 1 }}>
                  <a
                    className="link cursor-pointer block"
                    href={criticalPath.workItem.linkedIssue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {criticalPath.workItem.linkedIssue.summary}
                  </a>
                  <Button appearance="default" spacing="compact" onClick={(e) => toggleHighlight(criticalPath, e)}>
                    {toggleText(criticalPath)}
                  </Button>
                </div>
                <div style={{ gridRow: idx + 2, gridColumn: 2 }}>
                  {Math.round(criticalPath.totalDaysInCriticalPath)}
                </div>
                <div style={{ gridRow: idx + 2, gridColumn: 3 }}>
                  <ol>
                    {criticalPath.blockedPath.map((wi) => (
                      <li key={wi.linkedIssue.key}>
                        <a
                          className="link cursor-pointer"
                          href={wi.linkedIssue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {wi.linkedIssue.summary}
                        </a>
                      </li>
                    ))}
                  </ol>
                </div>
                <div style={{ gridRow: idx + 2, gridColumn: 4 }}>
                  {Math.round(criticalPath.totalDaysAcrossAllBlockedWork)}
                </div>
                <div style={{ gridRow: idx + 2, gridColumn: 5 }}>
                  <ul>
                    {criticalPath.otherBlockedWorkArr.map((wi) => (
                      <li key={wi.linkedIssue.key}>
                        <a
                          className="link cursor-pointer"
                          href={wi.linkedIssue.url}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {wi.linkedIssue.summary}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              </React.Fragment>
            ) : null,
          )}
        </div>
      )}
    </details>
  );
};
