import React, { FC, ReactNode, useId, useState } from 'react';

import Heading from '@atlaskit/heading';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';
import { Checkbox } from '@atlaskit/checkbox';

import {
  FALLBACKS_FOR,
  RawWorkSettings,
  WorkSettings,
  WorkSizeBy,
} from '../../../../../../jira/rollup/work-size/work-settings';
import { useWorkSettings } from '../../hooks/useWorkSettings';
import type { OtherWorkStatus } from '../../../../../../jira/rollup/work-size/other-work';
import { SizingExampleModal } from '../SizingExample';

/**
 * The Work part of the Rollup Calculation section (spec/046): how much work an epic is, laid out
 * like mockups/sizing-picture.html.
 */

/** The full explanation of other work; the Sources tab's tooltip is the short version. */
export const OTHER_WORK_OFF_WARNING =
  "Team time splits each day among a team's overlapping epics. Work outside your source JQL still takes up " +
  "the team's time, so leaving it out makes these epics look bigger. Turn on \"Include the team's other " +
  'overlapping work" in the Sources tab so it counts.';
export const OTHER_WORK_LIMITS = "Work without start/due dates or a Team field can't be found.";

/** Progress or the result line under "Include the team's other overlapping work". */
export function otherWorkMessage(status: OtherWorkStatus | undefined): string | null {
  switch (status?.status) {
    case 'loading':
      return status.total
        ? `Loading the team's other work… (${status.done} of ${status.total} teams)`
        : "Loading the team's other work…";
    case 'done': {
      const items = status.issues.length;
      const teams = status.teamCount;
      const failed = status.failedTeams.length
        ? ` Couldn't load ${status.failedTeams.length} ${status.failedTeams.length === 1 ? 'team' : 'teams'}: ${status.failedTeams.join(', ')}.`
        : '';
      return (
        `Loaded ${items} more ${items === 1 ? 'epic' : 'epics'} from ${teams} ${teams === 1 ? 'team' : 'teams'} ` +
        `to size team time. ${OTHER_WORK_LIMITS}${failed}`
      );
    }
    case 'unavailable':
      return status.reason;
    default:
      return null;
  }
}

const FieldLabel: FC<{ children: ReactNode }> = ({ children }) => (
  <p className="text-xs font-semibold pt-3 pb-1">{children}</p>
);

const RadioOption: FC<{
  name: string;
  value: string;
  checked: boolean;
  onChange: (value: string) => void;
  label: ReactNode;
  hint?: ReactNode;
  children?: ReactNode;
}> = ({ name, value, checked, onChange, label, hint, children }) => (
  <div className="py-0.5">
    <label className="flex gap-2 items-start text-sm cursor-pointer">
      <input
        type="radio"
        className="mt-1"
        name={name}
        value={value}
        checked={checked}
        onChange={() => onChange(value)}
      />
      <span>
        {label}
        {hint && <small className="block text-xs text-gray-600">{hint}</small>}
      </span>
    </label>
    {checked && children && <div className="pl-6 pt-1">{children}</div>}
  </div>
);

export interface WorkSettingsViewProps {
  settings: WorkSettings;
  onChange: (patch: RawWorkSettings) => void;
  /** Route data's `teamTimeOtherWork`. */
  otherWork?: OtherWorkStatus;
  /** Shows a "See how epics are sized" button that calls this (opens the sizing explanation). */
  onShowExample?: () => void;
}

export const WorkSettingsView: FC<WorkSettingsViewProps> = ({ settings, onChange, otherWork, onShowExample }) => {
  const id = useId();

  const setSizeBy = (sizeBy: string) => onChange({ sizeBy, sizeFallback: '' });
  const setFallback = (fallback: string) => {
    // the primary's default fallback is stored as '' so it stays out of the URL
    const isDefault = FALLBACKS_FOR[settings.sizeBy][0] === fallback;
    onChange({ sizeFallback: isDefault ? '' : fallback });
  };

  const sizeByRadio = (value: WorkSizeBy, label: string, hint: string, children?: ReactNode) => (
    <RadioOption
      name={`${id}-sizeBy`}
      value={value}
      checked={settings.sizeBy === value}
      onChange={setSizeBy}
      label={label}
      hint={hint}
    >
      {children}
    </RadioOption>
  );

  return (
    <div className="flex flex-col pt-4" data-testid="work-settings">
      <Heading size="small">How much work is an epic?</Heading>
      <p className="text-xs text-gray-600 pt-1">
        Whether an epic uses its own size or its stories' total follows the epic level's setting above.
      </p>
      {onShowExample && (
        <div className="pt-2">
          <Button spacing="compact" onClick={onShowExample}>
            See how epics are sized
          </Button>
        </div>
      )}

      <FieldLabel>Size each epic by</FieldLabel>
      <div role="radiogroup" aria-label="Size each epic by">
        {sizeByRadio(
          'teamTime',
          'Team time over its dates',
          'Its share of each day the team works on it; overlapping epics split the day by estimate',
          // The checkbox lives in the Sources tab; this only shows its result, or why to turn it on.
          <div className="flex flex-col gap-1">
            {settings.teamTimeOtherWork ? (
              <p className="text-xs text-gray-600" data-testid="other-work-result">
                {otherWorkMessage(otherWork)}
              </p>
            ) : (
              <SectionMessage appearance="warning">
                <p className="text-xs">{OTHER_WORK_OFF_WARNING}</p>
              </SectionMessage>
            )}
          </div>,
        )}
        {sizeByRadio('estimate', 'Its estimate', "Points or median + confidence, ÷ the team's velocity")}
        {sizeByRadio('dates', 'Its date span', 'Business days from start to due')}
      </div>

      {settings.sizeBy === 'estimate' && (
        <>
          <FieldLabel>If it has no estimate</FieldLabel>
          <div role="radiogroup" aria-label="If it has no estimate">
            {[
              ['dates', 'Use its date span'],
              ['teamTime', 'Use team time over its dates'],
              ['none', "Don't use dates"],
            ].map(([value, label]) => (
              <RadioOption
                key={value}
                name={`${id}-fallback`}
                value={value}
                checked={settings.sizeFallback === value}
                onChange={setFallback}
                label={label}
              />
            ))}
          </div>
        </>
      )}
      {(settings.sizeBy === 'teamTime' || settings.sizeBy === 'dates') && (
        <>
          <FieldLabel>If it has no dates</FieldLabel>
          <Checkbox
            label="Use its estimate"
            isChecked={settings.sizeFallback === 'estimate'}
            onChange={(event) => setFallback(event.target.checked ? 'estimate' : 'none')}
          />
        </>
      )}

      {settings.sizeBy === 'teamTime' && (
        <>
          <FieldLabel>If it has dates but no estimate</FieldLabel>
          <div role="radiogroup" aria-label="If it has dates but no estimate">
            <RadioOption
              name={`${id}-noEstimate`}
              value="averagePace"
              checked={settings.noEstimate === 'averagePace'}
              onChange={(noEstimate) => onChange({ noEstimate })}
              label="Use the team's average pace"
              hint="It gets a share of each day like an estimated epic"
            />
            <RadioOption
              name={`${id}-noEstimate`}
              value="leaveOut"
              checked={settings.noEstimate === 'leaveOut'}
              onChange={(noEstimate) => onChange({ noEstimate })}
              label="Leave it out of team time"
              hint="Other epics get its days; it falls through to the next rule"
            />
          </div>
        </>
      )}

      <FieldLabel>If it still has no size</FieldLabel>
      <div role="radiogroup" aria-label="If it still has no size">
        <RadioOption
          name={`${id}-missingSize`}
          value="levelAverage"
          checked={settings.missingSize === 'levelAverage'}
          onChange={(missingSize) => onChange({ missingSize })}
          label="Use the average size of its level"
        />
        <RadioOption
          name={`${id}-missingSize`}
          value="unsized"
          checked={settings.missingSize === 'unsized'}
          onChange={(missingSize) => onChange({ missingSize })}
          label="Leave it unsized"
        />
      </div>
    </div>
  );
};

const WorkSettingsSection: FC = () => {
  const { settings, update, otherWork } = useWorkSettings();
  const [showExample, setShowExample] = useState(false);
  return (
    <>
      <WorkSettingsView
        settings={settings}
        onChange={update}
        otherWork={otherWork}
        onShowExample={() => setShowExample(true)}
      />
      <SizingExampleModal
        isOpen={showExample}
        onClose={() => setShowExample(false)}
        settings={settings}
        settingsPanel={<WorkSettingsView settings={settings} onChange={update} otherWork={otherWork} />}
      />
    </>
  );
};

export default WorkSettingsSection;
