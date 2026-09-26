import type { FC } from 'react';

import React, { useState } from 'react';
import Heading from '@atlaskit/heading';
import SettingsIcon from '@atlaskit/icon/glyph/settings';
import ArrowRightCircleIcon from '@atlaskit/icon/glyph/arrow-right-circle';
import QuestionCircleIcon from '@atlaskit/icon/glyph/question-circle';
import Tooltip from '@atlaskit/tooltip';
import Textfield from '@atlaskit/textfield';
import SearchIcon from '@atlaskit/icon/core/search';

import SidebarButton from '../../../../../components/SidebarButton';
import { CanObservable, useCanObservable } from '../../../../../hooks/useCanObservable';
import Hr from '../../../../../components/Hr';
import TeamListItem from './components/TeamListItem';
import TeamSection from './components/TeamSection';
import OutsideReportTeams from './components/OutsideReportTeams';

const OUTSIDE_REPORT_HELP_TEXT =
  "Not seeing a team? This list only shows teams that have been configured before but aren't in this report. " +
  "To configure a team that isn't listed, add its work items to this report from the Sources tab.";

export interface TeamSelectorProps {
  teamsFromStorage: string[];
  selectedTeam: 'global' | (string & {});
  setSelectedTeam: (team: string) => void;
  derivedIssuesObservable: CanObservable<Array<{ team: { name: string } }> | undefined>;
}

const TeamSelector: FC<TeamSelectorProps> = ({
  selectedTeam,
  setSelectedTeam,
  teamsFromStorage,
  derivedIssuesObservable,
}) => {
  const derivedIssues = useCanObservable(derivedIssuesObservable);
  const derivedTeams = getDerivedTeams(derivedIssues);

  const teams = mergeTeams(derivedTeams, teamsFromStorage)
    .filter(({ name }) => name !== '__GLOBAL__')
    .sort((lhs, rhs) => lhs.name.localeCompare(rhs.name));

  const groups = Object.groupBy(teams, ({ status }) => status);
  const inReportTeams = [...(groups.storageAndReport ?? []), ...(groups.reportOnly ?? [])];
  const outsideReportTeams = groups.storageOnly ?? [];

  const [search, setSearch] = useState('');
  const query = search.trim().toLowerCase();
  const isSearching = query.length > 0;
  const matchesSearch = ({ name }: { name: string }) => name.toLowerCase().includes(query);

  const inReportMatches = inReportTeams.filter(matchesSearch);
  const outsideReportMatches = outsideReportTeams.filter(matchesSearch);

  return (
    <>
      <div className="my-4">
        <Heading size="small">Team Configuration</Heading>
      </div>
      <p className="text-xs font-semibold text-neutral-500">DEFAULT</p>
      <SidebarButton className="mt-2" isActive={selectedTeam === 'global'} onClick={() => setSelectedTeam('global')}>
        <SettingsIcon label="default settings" />
        <p className="flex-1">Default Settings</p>
        {selectedTeam === 'global' && <ArrowRightCircleIcon label="default settings selected" />}
      </SidebarButton>
      <Hr />
      <div className="mt-2 mb-2">
        <Textfield
          isCompact
          placeholder="Find a team"
          aria-label="Find a team"
          elemBeforeInput={
            <span className="flex items-center pl-2">
              <SearchIcon label="" color="var(--ds-icon-subtle)" />
            </span>
          }
          value={search}
          onChange={(e) => setSearch((e.target as HTMLInputElement).value)}
        />
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
        {(!isSearching || inReportMatches.length > 0) && (
          <TeamSection title="TEAMS IN REPORT" forceOpen={isSearching}>
            {inReportTeams.length === 0 ? (
              <p className="mt-2 text-xs text-neutral-500">No teams found. Add an issue source to show teams.</p>
            ) : (
              inReportMatches.map((team) => (
                <TeamListItem
                  key={team.name}
                  team={team}
                  selectedTeam={selectedTeam}
                  setSelectedTeam={setSelectedTeam}
                />
              ))
            )}
          </TeamSection>
        )}
        {outsideReportMatches.length > 0 && (
          <TeamSection
            title="TEAMS OUTSIDE REPORT"
            forceOpen={isSearching}
            titleAddon={
              <Tooltip content={OUTSIDE_REPORT_HELP_TEXT}>
                {(tooltipProps) => (
                  <button
                    {...tooltipProps}
                    type="button"
                    className="flex shrink-0 items-center text-neutral-400 hover:text-neutral-600"
                    aria-label="About teams outside report"
                  >
                    <QuestionCircleIcon label="" size="small" />
                  </button>
                )}
              </Tooltip>
            }
          >
            <OutsideReportTeams
              teams={outsideReportMatches}
              isFiltered={isSearching}
              selectedTeam={selectedTeam}
              setSelectedTeam={setSelectedTeam}
            />
          </TeamSection>
        )}
        {isSearching && inReportMatches.length === 0 && outsideReportMatches.length === 0 && (
          <p className="mt-2 text-xs text-neutral-500">No teams match "{search.trim()}"</p>
        )}
      </div>
    </>
  );
};

export default TeamSelector;

const getDerivedTeams = (derivedIssue: TeamSelectorProps['derivedIssuesObservable']['value']): string[] => {
  if (!derivedIssue) {
    return [];
  }

  return [...new Set(derivedIssue.map(({ team }) => team.name))];
};

const mergeTeams = (
  derivedTeams: string[],
  teamsFromStorage: string[],
): Array<{ name: string; status: 'reportOnly' | 'storageOnly' | 'storageAndReport' }> => {
  const allNames = [...new Set([...derivedTeams, ...teamsFromStorage])];

  return allNames.map((name) => {
    const inDerived = derivedTeams.includes(name);
    const inStorage = teamsFromStorage.includes(name);

    if (inDerived && inStorage) {
      return { name, status: 'storageAndReport' };
    }

    if (inDerived) {
      return { name, status: 'reportOnly' };
    }

    return { name, status: 'storageOnly' };
  });
};
