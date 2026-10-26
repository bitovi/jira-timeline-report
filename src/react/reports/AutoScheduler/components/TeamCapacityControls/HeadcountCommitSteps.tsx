import type { FC } from 'react';
import type { FieldLabel } from '../../../../SettingsSidebar/components/TeamConfiguration/components/Teams/shared/estimation';

import React, { useState } from 'react';
import Button from '@atlaskit/button/new';
import Popup from '@atlaskit/popup';

import { roundTo } from '../../../../../utils/number/number';

export interface HeadcountCommitStepsProps {
  savedTeamMembers: number;
  teamMembers: number;
  /** People one estimate assumes, as saved. */
  peoplePerEstimate: number;
  /** How the team's estimates are phrased: "half team". */
  sharePhrase: string;
  field: FieldLabel;
  /** Shares the Commit button's look, so the row reads the same as for every other unit. */
  className: string;
  isDisabled?: boolean;
}

const people = (count: number) => `${roundTo(count, 2)} ${roundTo(count, 2) === 1 ? 'person' : 'people'}`;

/**
 * Commit for a headcount change on a team-time unit (Team Days, Weeks, Sprints). There, a team's
 * estimates assume a share of the team ("half team"), so saving a new team size also redefines
 * every estimate already in Jira. Status Reports can't rewrite those, so instead of saving, Commit lists
 * the two manual steps. The what-if — the same estimates, more people — stays on the row until Reset.
 * See spec/040.
 */
export const HeadcountCommitSteps: FC<HeadcountCommitStepsProps> = ({
  savedTeamMembers,
  teamMembers,
  peoplePerEstimate,
  sharePhrase,
  field,
  className,
  isDisabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const from = roundTo(savedTeamMembers, 2);
  const to = roundTo(teamMembers, 2);
  // The same share of the new team: half of 10 (5) becomes half of 11 (5.5).
  const nextPeople = (peoplePerEstimate * teamMembers) / savedTeamMembers;

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-end"
      content={() => (
        <div className="flex w-80 flex-col gap-3 p-3 text-sm text-neutral-800" data-testid="headcount-commit-steps">
          <p className="font-semibold">Make {to} developers your team size</p>
          <p>
            Your estimates assume {sharePhrase}: {people(peoplePerEstimate)} of {from} developers. Saving a new team
            size changes what every estimate means, so this is done by hand:
          </p>
          <ol className="list-decimal space-y-1.5 pl-5">
            <li>
              In Jira, multiply each {field.plural} estimate by{' '}
              <span className="font-semibold">
                {from} ÷ {to}
              </span>
              . For example, 3 becomes <span className="font-semibold">{roundTo((3 * from) / to, 2)}</span>.
            </li>
            <li>
              In Team settings, set the developers to <span className="font-semibold">{to}</span>. Estimates will then
              assume {sharePhrase}: {people(nextPeople)}.
            </li>
          </ol>
          <div className="flex justify-end">
            <Button appearance="primary" spacing="compact" onClick={() => setIsOpen(false)}>
              Got it
            </Button>
          </div>
        </div>
      )}
      trigger={(triggerProps) => (
        <button
          {...triggerProps}
          type="button"
          className={className}
          disabled={isDisabled}
          onClick={() => setIsOpen(!isOpen)}
        >
          Commit
        </button>
      )}
    />
  );
};
