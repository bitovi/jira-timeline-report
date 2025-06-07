import React, { useMemo, useState, useCallback } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import type { DerivedIssue } from '../../../jira/derived/derive';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import ModalDialog, { ModalHeader, ModalBody, ModalFooter } from '@atlaskit/modal-dialog';
import Button from '@atlaskit/button';

const interactableClasses = 'hover:text-blue-400 cursor-pointer text-right inline-block';

interface EstimationProgressProps {
  primaryIssuesOrReleasesObs: CanObservable<Array<DerivedIssue>>;
  allIssuesOrReleasesObs: CanObservable<Array<DerivedIssue>>;
  rollupTimingLevelsAndCalculationsObs: CanObservable<any>;
}

function percent(top: number, bottom: number) {
  if (!bottom) return '0%';
  return (top * 100) / bottom + '%';
}
function emptyIfFalsey(value: any) {
  return value ? value : '';
}

function makeBaseRollup<IIssue = DerivedIssue>() {
  return {
    aboveEpic: {
      total: 0,
      noEpics: 0,
      noEpicIssues: [] as IIssue[],
      onlyUnestimated: 0,
      onlyUnestimatedIssues: [] as IIssue[],
      someEstimated: 0,
      someEstimatedIssues: [] as IIssue[],
      fullyEstimated: 0,
      fullyEstimatedIssues: [] as IIssue[],
    },
    epic: {
      estimated: 0,
      estimatedIssues: [] as IIssue[],
      unestimated: 0,
      unestimatedIssues: [] as IIssue[],
      total: 0,
    },
  };
}

type Rollup = ReturnType<typeof makeBaseRollup>;
type TeamRollup = Rollup & { name: string };
type DerivedIssueWithRollup = DerivedIssue & { rollups: Rollup };
type HierarchyLevel = {
  name: string;
  hierarchyLevel: number;
  issues: DerivedIssueWithRollup[];
  teams: Record<string, TeamRollup>;
  type: { name: string; iconUrl?: string };
};

function sortTeamsByEpicCountThenStatus(a: TeamRollup, b: TeamRollup) {
  if (a.epic.total > b.epic.total) return -1;
  if (a.epic.total < b.epic.total) return 1;
  if (a.epic.estimated > b.epic.estimated) return -1;
  if (a.epic.estimated < b.epic.estimated) return 1;
  return 0;
}
function sortIssuesByEpicCountThenStatus(a: DerivedIssueWithRollup, b: DerivedIssueWithRollup) {
  // Compare by rollups, but use team name fallback for missing name
  const aTeam: TeamRollup = { ...a.rollups, name: a.team?.name || 'No Team' };
  const bTeam: TeamRollup = { ...b.rollups, name: b.team?.name || 'No Team' };
  return sortTeamsByEpicCountThenStatus(aTeam, bTeam);
}

function makeGetParent(issues: DerivedIssueWithRollup[]) {
  const issueKeyToIssue: Record<string, DerivedIssueWithRollup[]> = {};
  for (const issue of issues) {
    const key = issue.key;
    if (!issueKeyToIssue[key]) issueKeyToIssue[key] = [];
    issueKeyToIssue[key].push(issue);
  }
  return function getParent(issue: DerivedIssueWithRollup) {
    if (issue.parentKey && issueKeyToIssue[issue.parentKey]) {
      return issueKeyToIssue[issue.parentKey][0];
    }
    return undefined;
  };
}

function updateRollup(rollups: Rollup, issue: DerivedIssueWithRollup) {
  rollups.epic.total += issue.rollups.epic.total;
  rollups.epic.estimated += issue.rollups.epic.estimated;
  rollups.epic.estimatedIssues.push(...issue.rollups.epic.estimatedIssues);
  rollups.epic.unestimated += issue.rollups.epic.unestimated;
  rollups.epic.unestimatedIssues.push(...issue.rollups.epic.unestimatedIssues);

  rollups.aboveEpic.total += issue.rollups.aboveEpic.total;
  rollups.aboveEpic.noEpics += issue.rollups.aboveEpic.noEpics;
  rollups.aboveEpic.noEpicIssues.push(...issue.rollups.aboveEpic.noEpicIssues);
  rollups.aboveEpic.fullyEstimated += issue.rollups.aboveEpic.fullyEstimated;
  rollups.aboveEpic.fullyEstimatedIssues.push(...issue.rollups.aboveEpic.fullyEstimatedIssues);
  rollups.aboveEpic.onlyUnestimated += issue.rollups.aboveEpic.onlyUnestimated;
  rollups.aboveEpic.onlyUnestimatedIssues.push(...issue.rollups.aboveEpic.onlyUnestimatedIssues);
  rollups.aboveEpic.someEstimated += issue.rollups.aboveEpic.someEstimated;
  rollups.aboveEpic.someEstimatedIssues.push(...issue.rollups.aboveEpic.someEstimatedIssues);
}

function ensureHierarchyLevelObjectAndTeamRollup(
  hierarchyLevels: Record<number, HierarchyLevel>,
  issue: DerivedIssueWithRollup,
  getTeamKey: (issue: DerivedIssueWithRollup) => string,
) {
  const hierarchyLevel = issue.hierarchyLevel;
  let hierarchyLevelObject = hierarchyLevels[hierarchyLevel];
  if (!hierarchyLevelObject) {
    hierarchyLevelObject = hierarchyLevels[hierarchyLevel] = {
      name: issue.type,
      hierarchyLevel,
      issues: [],
      teams: {},
      type: issue.issue.fields['Issue Type'],
    };
  }
  hierarchyLevelObject.issues.push(issue);
  const team = getTeamKey(issue);
  let teamRollup = hierarchyLevelObject.teams[team];
  if (!teamRollup) {
    teamRollup = hierarchyLevelObject.teams[team] = { ...makeBaseRollup<DerivedIssueWithRollup>(), name: team };
  }
  return { hierarchyLevelObject, teamRollup };
}

function updateTeamAndParentRollups(
  hierarchyLevels: Record<number, HierarchyLevel>,
  issue: DerivedIssueWithRollup,
  getTeamKey: (issue: DerivedIssueWithRollup) => string,
  getParent: (issue: DerivedIssueWithRollup) => DerivedIssueWithRollup | undefined,
) {
  let { teamRollup } = ensureHierarchyLevelObjectAndTeamRollup(hierarchyLevels, issue, getTeamKey);
  updateRollup(teamRollup, issue);
  let parent = getParent(issue);
  if (parent) {
    updateRollup(parent.rollups, issue);
  } else {
    //console.log("No parent found for issue", issue.key, issue.summary);
  }
}

function getReportingData(issues: DerivedIssue[]) {
  const issuesWithRollup: DerivedIssueWithRollup[] = issues.map((issue) => ({
    ...issue,
    rollups: makeBaseRollup<DerivedIssueWithRollup>(),
  }));
  issuesWithRollup.sort((a, b) => a.hierarchyLevel - b.hierarchyLevel);

  const getParent = makeGetParent(issuesWithRollup);
  const hierarchyLevels: Record<number, HierarchyLevel> = {};

  for (let issue of issuesWithRollup) {
    const hierarchyLevel = issue.hierarchyLevel;
    if (hierarchyLevel < 1) continue;

    if (hierarchyLevel === 1) {
      const estimate = issue.storyPoints ?? issue.storyPointsMedian ?? null;
      const confidence = issue.confidence ?? null;
      const isEstimated = estimate != null && confidence != null;
      issue.rollups.epic.total++;
      if (isEstimated) {
        issue.rollups.epic.estimated++;
        issue.rollups.epic.estimatedIssues.push(issue);
      } else {
        issue.rollups.epic.unestimated++;
        issue.rollups.epic.unestimatedIssues.push(issue);
      }
      updateTeamAndParentRollups(hierarchyLevels, issue, (iss) => iss.team?.name || 'No Team', getParent);
    } else if (hierarchyLevel === 2) {
      issue.rollups.aboveEpic.total = 1;
      if (issue.rollups.epic.total === 0) {
        issue.rollups.aboveEpic.noEpics = 1;
        issue.rollups.aboveEpic.noEpicIssues.push(issue);
      } else if (issue.rollups.epic.total === issue.rollups.epic.estimated) {
        issue.rollups.aboveEpic.fullyEstimated = 1;
        issue.rollups.aboveEpic.fullyEstimatedIssues.push(issue);
      } else if (issue.rollups.epic.total > 0 && issue.rollups.epic.estimated === 0) {
        issue.rollups.aboveEpic.onlyUnestimated = 1;
        issue.rollups.aboveEpic.onlyUnestimatedIssues.push(issue);
      } else {
        issue.rollups.aboveEpic.someEstimated = 1;
        issue.rollups.aboveEpic.someEstimatedIssues.push(issue);
      }
      updateTeamAndParentRollups(hierarchyLevels, issue, (iss) => iss.team?.name || 'No Team', getParent);
    } else {
      updateTeamAndParentRollups(hierarchyLevels, issue, (iss) => iss.team?.name || 'No Team', getParent);
    }
  }
  return hierarchyLevels;
}

const EstimationProgress: React.FC<EstimationProgressProps> = ({ allIssuesOrReleasesObs }) => {
  // Use observable hook to get issues
  const allIssues = useCanObservable(allIssuesOrReleasesObs) || [];

  // Modal state
  const [modalIssues, setModalIssues] = useState<DerivedIssue[] | null>(null);
  const [modalTitle, setModalTitle] = useState<string>('');

  // Reporting data
  const hierarchyLevelReportingData = useMemo(() => {
    const reportingData = getReportingData(allIssues);
    const levels = Object.values(reportingData);
    const sorted = levels
      .sort((a, b) => b.hierarchyLevel - a.hierarchyLevel)
      .map((level) => {
        const allIssuesRollup = {
          epicTotalMax: Math.max(...level.issues.map((i) => i.rollups.epic.total)),
          aboveEpicTotalMax: Math.max(...level.issues.map((i) => i.rollups.aboveEpic.total)),
        };
        const teamsArr = Object.values(level.teams) as TeamRollup[];
        const teams = teamsArr.sort(sortTeamsByEpicCountThenStatus);
        const allTeamsRollup = {
          epicTotalMax: Math.max(...teams.map((t) => t.epic.total)),
          aboveEpicTotalMax: Math.max(...teams.map((t) => t.aboveEpic.total)),
        };
        return {
          ...level,
          issues: level.issues.sort(sortIssuesByEpicCountThenStatus),
          allIssuesRollup,
          teams,
          allTeamsRollup,
        };
      });
    return sorted;
  }, [allIssues]);

  const aboveEpicTypeName = useMemo(() => {
    if (hierarchyLevelReportingData.length > 1) {
      return hierarchyLevelReportingData[hierarchyLevelReportingData.length - 2].name;
    }
    return '';
  }, [hierarchyLevelReportingData]);

  // Modal logic
  const showModal = useCallback(
    (rollupObj: any, type: string, valueName: string) => {
      const rollups = rollupObj.rollups || rollupObj;
      const issues = rollups[type][valueName + 'Issues'];
      const title =
        (
          {
            epic: {
              estimated: 'Estimated Epics',
              unestimated: 'Unestimated Epics',
            },
            aboveEpic: {
              noEpic: aboveEpicTypeName + 's that have no epics',
              onlyUnestimated: aboveEpicTypeName + 's whose epics have no estimates',
              someEstimated: aboveEpicTypeName + 's that are partially estimated',
              fullyEstimated: aboveEpicTypeName + 's that are fully estimated',
            },
          } as any
        )[type][valueName] || 'Issues';
      setModalTitle(title);
      setModalIssues(issues.flat(Infinity));
      // setTimeout(() => dialogRef.current?.showModal(), 0); // Remove native dialog
    },
    [aboveEpicTypeName],
  );

  // CSV download
  const downloadCSV = useCallback(() => {
    const rawData = hierarchyLevelReportingData;
    const rowsData: any[] = [];
    const flattenRollups = (rollups: any) => {
      const result: any = {};
      for (let key in rollups.aboveEpic) {
        result[aboveEpicTypeName + ' ' + key] = rollups.aboveEpic[key];
      }
      for (let key in rollups.epic) {
        result['epic ' + key] = rollups.epic[key];
      }
      return result;
    };
    for (let issueType of rawData) {
      for (let team of issueType.teams as TeamRollup[]) {
        rowsData.push({
          IssueType: issueType.type.name,
          RollupType: 'Team',
          Name: team.name,
          Team: team.name,
          ...flattenRollups(team),
        });
      }
      for (let issue of issueType.issues) {
        let teamName = issue.team?.name || 'No Team';
        rowsData.push({
          IssueType: issueType.type.name,
          RollupType: 'Issue',
          Name: issue.summary,
          Team: teamName,
          ...flattenRollups(issue.rollups),
        });
      }
    }
    function convertToCSV(data: any[]) {
      if (!data.length) return '';
      const headers = Object.keys(data[0]);
      const rows = data.map((obj) => headers.map((header) => JSON.stringify(obj[header] ?? '')).join(','));
      return [headers.join(','), ...rows].join('\r\n');
    }
    const csvContent = convertToCSV(rowsData);
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    if (link.download !== undefined) {
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', 'estimation-progress.csv');
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  }, [hierarchyLevelReportingData, aboveEpicTypeName]);

  // Modal close handler
  const handleDialogClose = () => setModalIssues(null);

  return (
    <>
      <div className="border border-neutral-30">
        <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr 1fr auto 1fr 1fr 1fr 1fr', gap: 4 }}>
          <div></div>
          <div style={{ gridColumn: '2 / span 3' }}>Epic</div>
          <div style={{ gridColumn: '5 / span 5' }} className="pl-8">
            {aboveEpicTypeName}s
          </div>
          <div>&nbsp;</div>
          <div className="text-xs text-right sticky top-0 bg-white pt-1">Total</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-complete pt-1 pr-1">Estimated</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-notstarted pt-1 pr-1">Unestimated</div>
          <div className="text-xs text-right sticky top-0 bg-white pt-1 pl-8">Total</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-complete pt-1 pr-1">Estimated</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-ontrack pt-1 pr-1">Partially estimated</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-behind pt-1 pr-1">Unestimated Epics</div>
          <div className="text-xs text-right sticky top-0 color-text-and-bg-notstarted pt-1 pr-1">Without epics</div>
          {hierarchyLevelReportingData.map((level, i: number) => (
            <React.Fragment key={i}>
              <h2
                style={{ gridColumn: '1 / 1' }}
                className="text-base grow font-semibold bg-neutral-20 sticky top-0 flex"
              >
                {level.type.iconUrl && <img src={level.type.iconUrl} className="inline pr-1" alt="" />}
                {level.name}
              </h2>
              <div style={{ gridColumn: '2 / -1' }} className="text-base grow font-semibold bg-neutral-20 flex">
                &nbsp;
              </div>
              <p className="text-xs pl-3" style={{ gridColumn: '1 / -1' }}>
                Team Rollup:
              </p>
              {level.teams.map((teamRollup, j: number) => (
                <React.Fragment key={j}>
                  <div className="pl-5">{teamRollup.name}</div>
                  <div className="text-right">{teamRollup.epic.total}</div>
                  <div style={{ gridColumn: '3 / span 2' }} className="flex">
                    <div
                      className={`${interactableClasses} color-text-and-bg-complete`}
                      style={{ width: percent(teamRollup.epic.estimated, level.allTeamsRollup.epicTotalMax) }}
                      onClick={() => showModal(teamRollup, 'epic', 'estimated')}
                    >
                      <span className="pr-1">{teamRollup.epic.estimated}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-notstarted`}
                      style={{ width: percent(teamRollup.epic.unestimated, level.allTeamsRollup.epicTotalMax) }}
                      onClick={() => showModal(teamRollup, 'epic', 'unestimated')}
                    >
                      <span className="pr-1">{teamRollup.epic.unestimated}</span>
                    </div>
                  </div>
                  <div className="text-right">{teamRollup.aboveEpic.total}</div>
                  <div style={{ gridColumn: '6 / span 4' }} className="flex">
                    <div
                      className={`${interactableClasses} color-text-and-bg-complete`}
                      onClick={() => showModal(teamRollup, 'aboveEpic', 'fullyEstimated')}
                      style={{
                        width: percent(teamRollup.aboveEpic.fullyEstimated, level.allTeamsRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(teamRollup.aboveEpic.fullyEstimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-ontrack`}
                      onClick={() => showModal(teamRollup, 'aboveEpic', 'someEstimated')}
                      style={{
                        width: percent(teamRollup.aboveEpic.someEstimated, level.allTeamsRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(teamRollup.aboveEpic.someEstimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-behind`}
                      onClick={() => showModal(teamRollup, 'aboveEpic', 'onlyUnestimated')}
                      style={{
                        width: percent(teamRollup.aboveEpic.onlyUnestimated, level.allTeamsRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(teamRollup.aboveEpic.onlyUnestimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-notstarted`}
                      onClick={() => showModal(teamRollup, 'aboveEpic', 'noEpics')}
                      style={{ width: percent(teamRollup.aboveEpic.noEpics, level.allTeamsRollup.aboveEpicTotalMax) }}
                    >
                      <span className="pr-1">{emptyIfFalsey(teamRollup.aboveEpic.noEpics)}</span>
                    </div>
                  </div>
                </React.Fragment>
              ))}
              <p className="text-xs pl-3" style={{ gridColumn: '1 / -1' }}>
                Issue Rollup:
              </p>
              {level.issues.map((issue: DerivedIssueWithRollup, k: number) => (
                <React.Fragment key={k}>
                  <div className="pl-5">
                    <a
                      target="_blank"
                      rel="noopener noreferrer"
                      href={issue.url}
                      className="truncate block max-w-md"
                      title={issue.summary}
                    >
                      {issue.summary}
                    </a>
                  </div>
                  <div className="text-right">{issue.rollups.epic.total}</div>
                  <div style={{ gridColumn: '3 / span 2' }} className="flex">
                    <div
                      className={`${interactableClasses} color-text-and-bg-complete`}
                      style={{ width: percent(issue.rollups.epic.estimated, level.allIssuesRollup.epicTotalMax) }}
                      onClick={() => showModal(issue, 'epic', 'estimated')}
                    >
                      <span className="pr-1">{issue.rollups.epic.estimated}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-notstarted`}
                      style={{ width: percent(issue.rollups.epic.unestimated, level.allIssuesRollup.epicTotalMax) }}
                      onClick={() => showModal(issue, 'epic', 'unestimated')}
                    >
                      <span className="pr-1">{emptyIfFalsey(issue.rollups.epic.unestimated)}</span>
                    </div>
                  </div>
                  <div className="text-right pl-6">{issue.rollups.aboveEpic.total}</div>
                  <div style={{ gridColumn: '6 / span 4' }} className="flex">
                    <div
                      className={`${interactableClasses} color-text-and-bg-complete`}
                      onClick={() => showModal(issue, 'aboveEpic', 'fullyEstimated')}
                      style={{
                        width: percent(issue.rollups.aboveEpic.fullyEstimated, level.allIssuesRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(issue.rollups.aboveEpic.fullyEstimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-ontrack`}
                      onClick={() => showModal(issue, 'aboveEpic', 'someEstimated')}
                      style={{
                        width: percent(issue.rollups.aboveEpic.someEstimated, level.allIssuesRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(issue.rollups.aboveEpic.someEstimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-behind`}
                      onClick={() => showModal(issue, 'aboveEpic', 'onlyUnestimated')}
                      style={{
                        width: percent(
                          issue.rollups.aboveEpic.onlyUnestimated,
                          level.allIssuesRollup.aboveEpicTotalMax,
                        ),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(issue.rollups.aboveEpic.onlyUnestimated)}</span>
                    </div>
                    <div
                      className={`${interactableClasses} color-text-and-bg-notstarted`}
                      onClick={() => showModal(issue, 'aboveEpic', 'noEpics')}
                      style={{
                        width: percent(issue.rollups.aboveEpic.noEpics, level.allIssuesRollup.aboveEpicTotalMax),
                      }}
                    >
                      <span className="pr-1">{emptyIfFalsey(issue.rollups.aboveEpic.noEpics)}</span>
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </React.Fragment>
          ))}
        </div>
      </div>
      {!!modalIssues && (
        <ModalDialog testId="estimation-progress-modal" onClose={handleDialogClose} width="medium">
          <ModalHeader>
            <h2 className="text-lg pb-4">{modalTitle}</h2>
          </ModalHeader>
          <ModalBody>
            <ul>
              {modalIssues.map((issue, idx) => (
                <li key={idx}>
                  <a target="_blank" rel="noopener noreferrer" href={issue.url}>
                    {issue.summary}
                  </a>
                </li>
              ))}
            </ul>
          </ModalBody>
          <ModalFooter>
            <Button appearance="default" onClick={handleDialogClose} autoFocus>
              Close
            </Button>
          </ModalFooter>
        </ModalDialog>
      )}
    </>
  );
};

export default EstimationProgress;
