import type { FC, ReactNode } from 'react';
import type { Configuration, IssueFields, TeamConfiguration } from './services/team-configuration';
import type { NormalizeIssueConfig } from '../../../../../../jira/normalized/normalize';

import React, { useState } from 'react';
import { IconButton } from '@atlaskit/button/new';
import DropdownMenu, { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import ShowMoreHorizontalIcon from '@atlaskit/icon/core/show-more-horizontal';
import Heading from '@atlaskit/heading';
import Spinner from '@atlaskit/spinner';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import { useIsMutating } from '@tanstack/react-query';

import { useTeamData } from './services/team-configuration';
import { updateTeamConfigurationKeys } from './services/team-configuration/key-factory';
import ConfigureTeamsForm from './ConfigureTeamsForm';
import { useTeamForm } from './useTeamForm';
import { useResetTeamSettings } from './useResetTeamSettings';
import { itemLabelFor } from './shared/estimation';
import ScrollableTabList from './components/ScrollableTabList';
import CustomSettingsDot from '../CustomSettingsDot';

/** A team with nothing saved gets empty placeholder levels, so look for a value rather than a level. */
export const levelHasSavedSettings = (saved: Configuration | undefined) =>
  Object.values(saved ?? {}).some((value) => value != null);

interface LevelFormProps {
  teamName: string;
  hierarchyLevel: keyof TeamConfiguration;
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  getInheritance: (hierarchyLevel: keyof TeamConfiguration) => TeamConfiguration;
  getHierarchyLevelName: (level: number | string) => string;
  jiraFields: IssueFields;
  inheritedTeamData: TeamConfiguration;
  savedUserTeamData: TeamConfiguration;
}

const LevelForm: FC<LevelFormProps> = ({ hierarchyLevel, jiraFields, getHierarchyLevelName, ...formData }) => {
  const { isSaving: _isSaving, ...formProps } = useTeamForm({ hierarchyLevel, ...formData });

  return (
    <ConfigureTeamsForm
      jiraFields={jiraFields}
      itemLabel={hierarchyLevel === 'defaults' ? null : itemLabelFor(getHierarchyLevelName(hierarchyLevel))}
      {...formProps}
    />
  );
};

export interface ConfigureTeamsProps {
  onUpdate?: (overrides: Partial<NormalizeIssueConfig>) => void;
  teamName: string;
  jiraFields: IssueFields;
  /** The heading above the tabs; defaults to the team's name. */
  title?: string;
  /**
   * The Defaults tab's content in place of the team's own defaults form — `__GLOBAL__` edits its
   * defaults with `AllTeamsDefaultForm`.
   */
  defaultsPanel?: ReactNode;
  defaultsLabel?: string;
}

/**
 * One tab per level a team's settings can be set at: its defaults, then each work item type from the
 * highest level down. Visited tabs stay mounted, so an unsaved input keeps its text across switches.
 */
const ConfigureTeams: FC<ConfigureTeamsProps> = ({
  teamName,
  jiraFields,
  onUpdate,
  title,
  defaultsPanel,
  defaultsLabel = 'Team Defaults',
}) => {
  const { inheritedTeamData, ...teamData } = useTeamData(teamName, jiraFields);
  // Every level saves through the one all-team-data mutation, so this covers whichever tab is saving.
  const isSaving = useIsMutating({ mutationKey: updateTeamConfigurationKeys.allTeamData }) > 0;
  const [selected, setSelected] = useState(0);
  const reset = useResetTeamSettings(teamName, onUpdate);

  const hierarchyLevels = Object.keys(inheritedTeamData)
    // defaults first, then highest level to lowest
    .sort((lhs, rhs) => {
      if (lhs === 'defaults') return -1;
      if (rhs === 'defaults') return 1;

      return parseInt(rhs) - parseInt(lhs);
    })
    .filter((level): level is keyof TeamConfiguration => level in inheritedTeamData);

  // The global defaults have nothing to inherit from, so a dot there would say nothing.
  const hasCustomSettings = (level: keyof TeamConfiguration) =>
    !(level === 'defaults' && defaultsPanel !== undefined) && levelHasSavedSettings(teamData.savedUserTeamData[level]);

  const levelLabel = (level: keyof TeamConfiguration) =>
    level === 'defaults' ? defaultsLabel : teamData.getHierarchyLevelName(level);

  // A global work item level falls back to the global defaults, so it resets like a team's level. The
  // global defaults themselves have nothing under them (and no dot), and there is no "whole team".
  const isGlobal = teamName === '__GLOBAL__';
  const selectedLevel = hierarchyLevels[selected];
  const canResetSelectedLevel = !!selectedLevel && hasCustomSettings(selectedLevel);
  const canResetTeam = !isGlobal && hierarchyLevels.some(hasCustomSettings);

  const levelForm = (hierarchyLevel: keyof TeamConfiguration) => (
    <LevelForm
      teamName={teamName}
      hierarchyLevel={hierarchyLevel}
      onUpdate={onUpdate}
      jiraFields={jiraFields}
      inheritedTeamData={inheritedTeamData}
      {...teamData}
    />
  );

  return (
    // The name and tabs stay put; only the selected tab's form scrolls.
    <div className="flex min-h-0 flex-1 flex-col pt-6">
      <div className="mb-4 flex min-h-8 items-center gap-2 px-6">
        <div className="min-w-0 break-words">
          <Heading size="small">{title ?? teamName}</Heading>
        </div>
        {isSaving && <Spinner size="small" label="saving" />}
        {/* A menu rather than buttons, so a long team name keeps the row; nothing to reset, no menu. */}
        {(canResetSelectedLevel || canResetTeam) && (
          <div className="ml-auto shrink-0">
            <DropdownMenu
              placement="bottom-end"
              trigger={({ triggerRef, ...props }) => (
                <IconButton
                  {...props}
                  ref={triggerRef}
                  icon={ShowMoreHorizontalIcon}
                  label={`Reset settings for ${title ?? teamName}`}
                  appearance="subtle"
                />
              )}
            >
              <DropdownItemGroup>
                {canResetSelectedLevel && (
                  <DropdownItem isDisabled={isSaving} onClick={() => reset.resetLevel(selectedLevel)}>
                    Reset {levelLabel(selectedLevel)}
                  </DropdownItem>
                )}
                {canResetTeam && (
                  <DropdownItem isDisabled={isSaving} onClick={reset.resetTeam}>
                    Reset whole team
                  </DropdownItem>
                )}
              </DropdownItemGroup>
            </DropdownMenu>
          </div>
        )}
      </div>
      <Tabs id={`team-configuration-${teamName}`} selected={selected} onChange={setSelected}>
        <div className="px-6">
          <ScrollableTabList>
            <TabList>
              {hierarchyLevels.map((level) => (
                <Tab key={level}>
                  {levelLabel(level)}
                  {hasCustomSettings(level) && <CustomSettingsDot className="ml-1.5 align-middle" />}
                </Tab>
              ))}
            </TabList>
          </ScrollableTabList>
        </div>
        {hierarchyLevels.map((level) => (
          <TabPanel key={level}>
            {/* Atlaskit makes each panel a flex item that fills what is left, so this is the scroller. */}
            <div className="w-full overflow-y-auto px-6 pb-4">
              {level === 'defaults' && defaultsPanel !== undefined ? defaultsPanel : levelForm(level)}
            </div>
          </TabPanel>
        ))}
      </Tabs>
    </div>
  );
};

export default ConfigureTeams;
