import type { Configuration } from '../../services/team-configuration';
import type { ItemLabel } from '../../shared/estimation';

import React from 'react';
import { useForm } from 'react-hook-form';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyConfiguration } from '../../services/team-configuration';
import { getEffectiveVelocity, itemLabelFor } from '../../shared/estimation';
import EstimationQuestions from './EstimationQuestions';

const UNIT_QUESTION = /What units do you use to estimate/;
const SPRINT_QUESTION = 'How many weeks are in a sprint?';
const SHARE_QUESTION = 'How much of the team does one estimate assume?';
const WEEK_NOTE = 'One week is 5 working days.';
const POINTS_QUESTION = 'On average, how many story points does your team complete per sprint?';
const MEMBERS_QUESTION = 'How many developers are on the team?';
const PARALLEL_QUESTION = /can your team work on in parallel, on average\?/;
const WARNING = /Team members will need to split their time across multiple/;

const ALL_QUESTIONS = [
  UNIT_QUESTION,
  SPRINT_QUESTION,
  SHARE_QUESTION,
  MEMBERS_QUESTION,
  POINTS_QUESTION,
  PARALLEL_QUESTION,
];

const resolved = (overrides: Partial<Configuration>): Configuration => ({
  ...createEmptyConfiguration(),
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  estimateUnit: 'storyPoints',
  teamMembers: 10,
  estimateTeamShare: 'full',
  ...overrides,
});

const Harness = ({
  mode = 'global',
  values,
  saved = createEmptyConfiguration(),
  itemLabel = null,
  estimateFieldOptions = [],
  update = vi.fn(),
  updateFields = vi.fn(),
  toggleInheritance = vi.fn(),
  hasSavedHeadcount = true,
}: {
  mode?: 'global' | 'inheriting';
  values: Configuration;
  saved?: Configuration;
  itemLabel?: ItemLabel | null;
  estimateFieldOptions?: Array<{ value: string; label: string }>;
  update?: () => void;
  updateFields?: (patch: Partial<Configuration>) => void;
  toggleInheritance?: (field: keyof Configuration, customize: boolean, alsoWrite?: Partial<Configuration>) => void;
  hasSavedHeadcount?: boolean;
}) => {
  // The real forms seed `defaultValues` with the inherited data, so an inherited unit is a value too.
  const { register, control, setValue } = useForm<Configuration>({ defaultValues: values });

  return (
    <EstimationQuestions
      mode={mode}
      control={control}
      register={register}
      update={update}
      updateFields={updateFields}
      setValue={setValue}
      savedUserData={saved}
      toggleInheritance={toggleInheritance}
      hasSavedHeadcount={hasSavedHeadcount}
      itemLabel={itemLabel}
      estimateFieldOptions={estimateFieldOptions}
    />
  );
};

const shownQuestions = () =>
  ALL_QUESTIONS.filter((question) => screen.queryByText(question) !== null).map((question) => String(question));

const summary = () => screen.getByTestId('estimation-summary').textContent;

const chooseUnit = (label: string) => {
  // react-select renders a combobox; picking an option through the DOM needs the menu opened.
  fireEvent.keyDown(screen.getAllByRole('combobox')[0], { key: 'ArrowDown' });
  fireEvent.click(screen.getByText(label));
};

const escape = (text: string) => new RegExp(text.replace(/[?]/g, '\\?'));
const parallelInput = () => screen.getByLabelText(PARALLEL_QUESTION);
const membersInput = () => screen.getByLabelText(escape(MEMBERS_QUESTION));
const chooseShare = (label: string) => {
  // The unit select is first; the share select is the only other one.
  fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'ArrowDown' });
  fireEvent.click(screen.getAllByText(label).at(-1)!);
};
const peopleShare = () => screen.getByTestId('people-share').textContent;
const pointsInput = () => screen.getByLabelText(escape(POINTS_QUESTION));
const sprintWeeksInput = () => screen.getByLabelText(escape(SPRINT_QUESTION));

const retype = async (input: HTMLElement, text: string) => {
  await userEvent.clear(input);
  await userEvent.type(input, text);
  await userEvent.tab();
};

/** The single patch the form wrote. */
const lastPatch = (updateFields: ReturnType<typeof vi.fn>) =>
  updateFields.mock.calls.at(-1)![0] as Partial<Configuration>;

/** Half of 10 developers on Team Weeks: 5 people per estimate, X = 1 / (5 × 5) derived from the share. */
const halfTeamWeeks = (overrides: Partial<Configuration> = {}) =>
  resolved({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', tracks: 2, ...overrides });

describe('EstimationQuestions', () => {
  it.each([
    ['storyPoints', [UNIT_QUESTION, SPRINT_QUESTION, MEMBERS_QUESTION, POINTS_QUESTION, PARALLEL_QUESTION]],
    ['devDays', [UNIT_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamDays', [UNIT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamWeeks', [UNIT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamSprints', [UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
  ] as const)('%s asks exactly its questions', (unit, questions) => {
    render(<Harness values={resolved({ estimateUnit: unit })} />);

    expect(shownQuestions()).toEqual(questions.map(String));
  });

  it.each(['teamDays', 'teamWeeks', 'teamSprints'] as const)('%s offers the four shares', (unit) => {
    render(<Harness values={resolved({ estimateUnit: unit })} />);

    fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'ArrowDown' });

    for (const label of ['Half team', 'One third team', 'Quarter team']) {
      expect(screen.getByText(label)).toBeInTheDocument();
    }
    expect(screen.getAllByText('Full team').length).toBeGreaterThan(0);
  });

  it('notes the length of a week only for Team Weeks', () => {
    const { unmount } = render(<Harness values={resolved({ estimateUnit: 'teamWeeks' })} />);
    expect(screen.getByText(WEEK_NOTE)).toBeInTheDocument();
    unmount();

    render(<Harness values={resolved({ estimateUnit: 'teamDays' })} />);
    expect(screen.queryByText(WEEK_NOTE)).not.toBeInTheDocument();
  });

  it('a config with no unit asks the story point questions', () => {
    render(<Harness values={resolved({ estimateUnit: null })} />);

    expect(screen.getByText(POINTS_QUESTION)).toBeInTheDocument();
  });

  describe('share of the team', () => {
    it('shows the people a saved share means at the current headcount', () => {
      render(<Harness values={halfTeamWeeks()} />);

      expect(peopleShare()).toBe('Half team of 10 developers: estimates assume 5 people.');
    });

    it.each([
      ['Full team', 'full', 1],
      ['One third team', 'third', 3],
      ['Quarter team', 'quarter', 4],
    ] as const)('choosing %s saves the share, clears X and resets the parallel count', (label, share, tracks) => {
      const updateFields = vi.fn();
      render(<Harness values={halfTeamWeeks({ tracks: 7 })} updateFields={updateFields} />);

      chooseShare(label);

      expect(lastPatch(updateFields)).toEqual({ estimateTeamShare: share, pointsPerPersonDay: null, tracks });
      expect(parallelInput()).toHaveValue(tracks);
    });

    it('X follows the share of the saved team', () => {
      expect(getEffectiveVelocity(halfTeamWeeks())).toBeCloseTo(
        getEffectiveVelocity(halfTeamWeeks({ teamMembers: 20 })),
      );
    });

    it('a Team Sprints sprint length clears X, since the share defines it', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'teamSprints', estimateTeamShare: 'half' })}
          updateFields={updateFields}
        />,
      );

      await retype(sprintWeeksInput(), '3');

      expect(lastPatch(updateFields)).toEqual({ sprintLength: 15, pointsPerPersonDay: null });
    });

    it('the people follow the headcount, since the share is what is saved', async () => {
      render(<Harness values={halfTeamWeeks()} />);

      await retype(membersInput(), '11');

      expect(peopleShare()).toBe('Half team of 11 developers: estimates assume 5.5 people.');
    });
  });

  describe('switching unit', () => {
    it('writes the unit with X for it, and the questions follow', () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({})} updateFields={updateFields} />);

      chooseUnit('Dev Days');

      expect(updateFields).toHaveBeenCalledWith({ estimateUnit: 'devDays', pointsPerPersonDay: 1, tracks: 10 });
      expect(screen.getByText(MEMBERS_QUESTION)).toBeInTheDocument();
      expect(screen.queryByText(POINTS_QUESTION)).not.toBeInTheDocument();
      expect(summary()).toBe(
        '1 estimate is 1 day of work for 1 developer. 10 developers. With 10 work items in parallel.',
      );
    });

    it('a team-time unit starts at the full team', () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ tracks: 3, estimateTeamShare: null })} updateFields={updateFields} />);

      chooseUnit('Team Weeks');

      expect(lastPatch(updateFields)).toEqual({
        estimateUnit: 'teamWeeks',
        estimateTeamShare: 'full',
        pointsPerPersonDay: null,
        tracks: 1,
      });
    });

    it('keeps the share when moving between team-time units', () => {
      const updateFields = vi.fn();
      render(<Harness values={halfTeamWeeks()} updateFields={updateFields} />);

      chooseUnit('Team Working Days');

      expect(lastPatch(updateFields)).toEqual({
        estimateUnit: 'teamDays',
        estimateTeamShare: 'half',
        pointsPerPersonDay: null,
        tracks: 2,
      });
    });

    it('Story Points takes its points per sprint and leaves the parallel count alone', () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', velocityPerSprint: 30, tracks: 3 })}
          updateFields={updateFields}
        />,
      );

      chooseUnit('Story Points');

      expect(updateFields).toHaveBeenCalledWith({ estimateUnit: 'storyPoints', pointsPerPersonDay: 0.3 });
      expect(parallelInput()).toHaveValue(3);
    });
  });

  describe('Story Points capacity', () => {
    it('shows points per sprint calculated from X', () => {
      render(<Harness values={resolved({ pointsPerPersonDay: 0.21 })} />);

      expect(pointsInput()).toHaveValue(21);
    });

    it('editing points per sprint writes X = points / (developers × sprint days)', async () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ pointsPerPersonDay: 0.21 })} updateFields={updateFields} />);

      await retype(pointsInput(), '30');

      expect(updateFields).toHaveBeenCalledTimes(1);
      expect(lastPatch(updateFields).pointsPerPersonDay).toBeCloseTo(0.3);
    });

    // Regression: computed against the typed sprint length, X was left unchanged.
    it('a longer sprint keeps points per sprint by rewriting X', async () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ pointsPerPersonDay: 0.21 })} updateFields={updateFields} />);

      await retype(sprintWeeksInput(), '3');

      const patch = lastPatch(updateFields);
      expect(patch.sprintLength).toBe(15);
      expect(patch.pointsPerPersonDay).toBeCloseTo(0.14);
      expect(pointsInput()).toHaveValue(21);
    });

    it('a headcount change scales points per sprint and leaves the parallel count alone', async () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ pointsPerPersonDay: 0.21, tracks: 3 })} updateFields={updateFields} />);

      await retype(membersInput(), '11');

      expect(lastPatch(updateFields)).toEqual({ teamMembers: 11 });
      expect(pointsInput()).toHaveValue(23.1);
      expect(parallelInput()).toHaveValue(3);
    });

    it('customizes inherited points per sprint along with a headcount change, so they never read as inherited', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          mode="inheriting"
          values={resolved({ pointsPerPersonDay: 0.21 })}
          saved={{ ...createEmptyConfiguration(), teamMembers: 10 }}
          updateFields={updateFields}
        />,
      );

      await retype(membersInput(), '11');

      expect(lastPatch(updateFields)).toEqual({
        teamMembers: 11,
        estimateUnit: 'storyPoints',
        pointsPerPersonDay: 0.21,
      });
    });

    it('writes only the headcount when the level already has its own points per sprint', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          mode="inheriting"
          values={resolved({ pointsPerPersonDay: 0.21 })}
          saved={{ ...createEmptyConfiguration(), teamMembers: 10, pointsPerPersonDay: 0.21 }}
          updateFields={updateFields}
        />,
      );

      await retype(membersInput(), '11');

      expect(lastPatch(updateFields)).toEqual({ teamMembers: 11 });
    });
  });

  describe('headcount', () => {
    it('Dev Days resets the parallel count to the headcount', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 1 })}
          updateFields={updateFields}
        />,
      );

      await retype(membersInput(), '6');

      expect(lastPatch(updateFields)).toEqual({ teamMembers: 6, tracks: 6 });
      expect(parallelInput()).toHaveValue(6);
    });

    it('accepts decimals, rounding the Dev Days parallel count down', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 1 })}
          updateFields={updateFields}
        />,
      );

      await retype(membersInput(), '5.5');

      expect(lastPatch(updateFields)).toEqual({ teamMembers: 5.5, tracks: 5 });
    });

    it.each(['teamDays', 'teamWeeks', 'teamSprints'] as const)(
      '%s saves only the headcount; the parallel count stays one per share',
      async (unit) => {
        const updateFields = vi.fn();
        render(
          <Harness
            values={resolved({ estimateUnit: unit, estimateTeamShare: 'half', tracks: 2 })}
            updateFields={updateFields}
          />,
        );

        await retype(membersInput(), '20');

        expect(lastPatch(updateFields)).toEqual({ teamMembers: 20, tracks: 2 });
      },
    );

    it('a team-time headcount saved in settings redefines the estimates, so velocity per estimate holds', async () => {
      const updateFields = vi.fn();
      const values = halfTeamWeeks();
      render(<Harness values={values} updateFields={updateFields} hasSavedHeadcount />);

      await retype(membersInput(), '11');

      const patch = lastPatch(updateFields);
      expect(patch).toEqual({ teamMembers: 11, tracks: 2 });
      // Half of 11 is a bigger estimate, so the same share of the team finishes the same number of them.
      expect(getEffectiveVelocity({ ...values, ...patch })).toBeCloseTo(getEffectiveVelocity(values));
    });

    it('a team-time headcount clears an X stored on the level, so the share defines it', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={halfTeamWeeks({ pointsPerPersonDay: 1 / 25 })}
          saved={{ ...createEmptyConfiguration(), pointsPerPersonDay: 1 / 25 }}
          updateFields={updateFields}
        />,
      );

      await retype(membersInput(), '11');

      expect(lastPatch(updateFields)).toEqual({ teamMembers: 11, pointsPerPersonDay: null, tracks: 2 });
    });

    // Regression: computed against the typed value instead of the previous one, re-anchoring was a no-op.
    it('the first headcount a team enters re-anchors X, so capacity stays the same', async () => {
      const updateFields = vi.fn();
      // Never entered: scheduled against the default 5, X derived from 21 points per sprint.
      const values = resolved({ teamMembers: 5, velocityPerSprint: 21 });
      render(<Harness values={values} updateFields={updateFields} hasSavedHeadcount={false} />);

      await retype(membersInput(), '10');

      const patch = lastPatch(updateFields);
      expect(patch.teamMembers).toBe(10);
      expect(patch.pointsPerPersonDay).toBeCloseTo(0.21);
      expect(getEffectiveVelocity({ ...values, ...patch })).toBeCloseTo(21);
      expect(pointsInput()).toHaveValue(21);
    });

    it('a saved headcount with X still derived pins X, so the headcount counts', async () => {
      const updateFields = vi.fn();
      const values = resolved({ teamMembers: 10, velocityPerSprint: 30 });
      render(<Harness values={values} updateFields={updateFields} hasSavedHeadcount />);

      await retype(membersInput(), '20');

      const patch = lastPatch(updateFields);
      expect(patch.pointsPerPersonDay).toBeCloseTo(0.3);
      expect(getEffectiveVelocity({ ...values, ...patch })).toBeCloseTo(60);
    });

    it('does not save an emptied or zero headcount', async () => {
      const updateFields = vi.fn();
      const update = vi.fn();
      render(<Harness values={resolved({})} updateFields={updateFields} update={update} />);

      await retype(membersInput(), '0');
      await userEvent.clear(membersInput());
      await userEvent.tab();

      expect(updateFields).not.toHaveBeenCalled();
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('the Dev Days warning', () => {
    it('appears when more items run in parallel than there are members', () => {
      render(<Harness values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 3 })} />);

      expect(screen.getByText(WARNING)).toBeInTheDocument();
    });

    it('does not appear when every item can have someone', () => {
      render(<Harness values={resolved({ estimateUnit: 'devDays', teamMembers: 3, tracks: 3 })} />);

      expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
    });

    it('does not appear for other units', () => {
      render(<Harness values={resolved({ estimateUnit: 'storyPoints', teamMembers: 1, tracks: 3 })} />);

      expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
    });

    it('follows the parallel field as it is typed', async () => {
      render(<Harness values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 1 })} />);

      await userEvent.clear(parallelInput());
      await userEvent.type(parallelInput(), '5');

      expect(screen.getByText(WARNING)).toBeInTheDocument();
    });
  });

  describe('the summary', () => {
    it('Story Points names the field, the sprint and the headcount', () => {
      render(
        <Harness
          values={resolved({ pointsPerPersonDay: 0.21, tracks: 2, estimateField: 'Story Points' })}
          estimateFieldOptions={[{ value: 'Story Points', label: 'Story Points' }]}
        />,
      );

      expect(summary()).toBe('21 Story Points per 2-week sprint with 10 developers. With 2 work items in parallel.');
    });

    it('a team-time unit says what one estimate means', () => {
      render(
        <Harness
          values={halfTeamWeeks({ estimateField: 'Story Points' })}
          estimateFieldOptions={[{ value: 'Story Points', label: 'Story Points' }]}
        />,
      );

      expect(summary()).toBe(
        '1 Story Point is 1 week of work for 5 people (50% of the team). 10 developers. With 2 work items in parallel.',
      );
    });

    it('updates once a headcount is entered', async () => {
      render(<Harness values={halfTeamWeeks()} />);

      await retype(membersInput(), '20');

      expect(summary()).toBe(
        '1 estimate is 1 week of work for 10 people (50% of the team). 20 developers. With 2 work items in parallel.',
      );
    });

    it('updates once a sprint length is entered, keeping points per sprint', async () => {
      render(<Harness values={resolved({ pointsPerPersonDay: 0.4 })} />);

      await retype(sprintWeeksInput(), '3');

      expect(summary()).toBe('40 estimates per 3-week sprint with 10 developers. One work item at a time.');
      expect(screen.getByTestId('unestimated-hint').textContent).toBe(
        'Work items without estimates default to 15 working days.',
      );
    });
  });

  it.each([
    ['a share change', () => chooseShare('Full team')],
    ['a headcount change', () => retype(membersInput(), '11')],
  ])('shows no convert-your-estimates warning for %s', async (_change, act) => {
    render(<Harness values={halfTeamWeeks()} />);

    await act();

    expect(screen.queryByText('Update your existing estimates in Jira')).not.toBeInTheDocument();
  });

  describe('sprint length in weeks', () => {
    it('shows a stored sprint length of working days as weeks', () => {
      render(<Harness values={resolved({ sprintLength: 10 })} />);

      expect(sprintWeeksInput()).toHaveValue(2);
    });

    it('shows a sprint length that is not whole weeks as a fraction', () => {
      render(<Harness values={resolved({ sprintLength: 7 })} />);

      expect(sprintWeeksInput()).toHaveValue(1.4);
    });

    it('does not save an emptied field', async () => {
      const update = vi.fn();
      const updateFields = vi.fn();
      render(<Harness values={resolved({ sprintLength: 10 })} update={update} updateFields={updateFields} />);

      await userEvent.clear(sprintWeeksInput());
      await userEvent.tab();

      expect(update).not.toHaveBeenCalled();
      expect(updateFields).not.toHaveBeenCalled();
    });

    it('labels every number field on the global form with its own question', () => {
      render(<Harness values={resolved({ pointsPerPersonDay: 0.4, teamMembers: 10, tracks: 2 })} />);

      expect(pointsInput()).toHaveValue(40);
      expect(membersInput()).toHaveValue(10);
      expect(parallelInput()).toHaveValue(2);
    });

    it('shows an inherited value as text, in weeks', () => {
      render(<Harness mode="inheriting" values={resolved({ estimateUnit: 'teamSprints', sprintLength: 15 })} />);

      const sprintRow = screen.getByText(SPRINT_QUESTION).closest('.grid') as HTMLElement;
      expect(within(sprintRow).getByTestId('inherited-value')).toHaveTextContent('3 weeks');
      expect(within(sprintRow).queryByRole('spinbutton')).not.toBeInTheDocument();
    });

    it('names a single unit in the singular', () => {
      render(<Harness mode="inheriting" values={resolved({ estimateUnit: 'devDays', teamMembers: 1 })} />);

      const membersRow = screen.getByText(MEMBERS_QUESTION).closest('.grid') as HTMLElement;
      expect(within(membersRow).getByTestId('inherited-value')).toHaveTextContent(/^1 developer$/);
    });

    it('shows the input once the level customizes it', () => {
      render(
        <Harness
          mode="inheriting"
          values={resolved({ estimateUnit: 'teamSprints', sprintLength: 15 })}
          saved={{ ...createEmptyConfiguration(), sprintLength: 15 }}
        />,
      );

      expect(sprintWeeksInput()).toHaveValue(3);
      expect(sprintWeeksInput()).toBeEnabled();
    });
  });

  describe('the unit hints', () => {
    const hint = () => screen.getByTestId('unit-hint').textContent;

    it('names the estimate field', () => {
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', estimateField: 'Story points' })}
          itemLabel={itemLabelFor('Epic')}
          estimateFieldOptions={[{ value: 'Story points', label: 'Story points' }]}
        />,
      );

      expect(hint()).toBe('The Story points your team puts on your Epics represent dev days.');
    });

    it('shows the label of a field stored by id', () => {
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', estimateField: 'customfield_10020' })}
          estimateFieldOptions={[{ value: 'customfield_10020', label: 'Story points (customfield_10020)' }]}
        />,
      );

      expect(hint()).toBe('The Story points (customfield_10020) your team puts on your work items represent dev days.');
    });

    it('falls back to "estimates" without an estimate field, following the unit', () => {
      render(<Harness values={resolved({ estimateUnit: 'devDays' })} itemLabel={itemLabelFor('Story')} />);

      expect(hint()).toBe('The estimates your team puts on your Stories represent dev days.');

      chooseUnit('Team Working Days');

      expect(hint()).toBe('The estimates your team puts on your Stories represent team working days.');
    });

    it('says "work items" on a defaults form', () => {
      render(<Harness values={resolved({ estimateUnit: 'teamWeeks' })} />);

      expect(hint()).toBe('The estimates your team puts on your work items represent team weeks.');
    });

    it('says nothing about story points, which need no explaining', () => {
      render(<Harness values={resolved({ estimateUnit: 'storyPoints' })} />);

      expect(screen.queryByTestId('unit-hint')).not.toBeInTheDocument();
    });

    it('says how long an unestimated item takes, following the unit', () => {
      render(<Harness values={resolved({ sprintLength: 15 })} />);

      const unestimatedHint = () => screen.getByTestId('unestimated-hint').textContent;
      expect(unestimatedHint()).toBe('Work items without estimates default to 15 working days.');

      chooseUnit('Dev Days');

      expect(unestimatedHint()).toBe('Work items without estimates default to 10 working days.');
    });
  });

  describe('labels', () => {
    it('says "as a team" and "work items" on a defaults form', () => {
      render(<Harness values={resolved({ estimateUnit: 'teamDays' })} />);

      expect(screen.getByText('What units do you use to estimate as a team?')).toBeInTheDocument();
      expect(
        screen.getByText('How many work items can your team work on in parallel, on average?'),
      ).toBeInTheDocument();
    });

    it('names the work item type on a level accordion', () => {
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', tracks: 2, teamMembers: 1 })}
          itemLabel={itemLabelFor('Epic')}
        />,
      );

      expect(screen.getByText('What units do you use to estimate Epics?')).toBeInTheDocument();
      expect(screen.getByText('How many Epics can your team work on in parallel, on average?')).toBeInTheDocument();
      expect(screen.getByText('Team members will need to split their time across multiple Epics.')).toBeInTheDocument();
      expect(summary()).toBe('1 estimate is 1 day of work for 1 developer. 1 developer. With 2 Epics in parallel.');
    });
  });

  describe('inheriting mode', () => {
    it('follows an inherited unit, with the fields left inheriting', () => {
      render(
        <Harness mode="inheriting" values={resolved({ estimateUnit: 'teamSprints', estimateTeamShare: 'half' })} />,
      );

      expect(shownQuestions()).toEqual(
        [UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION].map(String),
      );
      expect(summary()).toBe(
        '1 estimate is one 2-week sprint of work for 5 people (50% of the team). 10 developers. One work item at a time.',
      );
      const unitRow = screen.getByText(UNIT_QUESTION).closest('.grid') as HTMLElement;
      expect(within(unitRow).getByTestId('inherited-value')).toHaveTextContent('Team Sprints');
      const shareRow = screen.getByText(SHARE_QUESTION).closest('.grid') as HTMLElement;
      expect(within(shareRow).getByTestId('inherited-value')).toHaveTextContent('Half team');
    });

    it('keeps each question labelling its customized input', () => {
      render(
        <Harness
          mode="inheriting"
          values={resolved({ estimateUnit: 'devDays', teamMembers: 4 })}
          saved={{ ...createEmptyConfiguration(), estimateUnit: 'devDays', teamMembers: 4 }}
        />,
      );

      expect(screen.getByLabelText(UNIT_QUESTION)).toHaveRole('combobox');
      expect(membersInput()).toHaveValue(4);
    });

    it('marks a field the level saved itself as customized', () => {
      render(
        <Harness
          mode="inheriting"
          values={resolved({ estimateUnit: 'devDays', teamMembers: 4 })}
          saved={{ ...createEmptyConfiguration(), teamMembers: 4 }}
        />,
      );

      const membersRow = screen.getByText(MEMBERS_QUESTION).closest('.grid') as HTMLElement;
      expect(within(membersRow).getByRole('button', { name: 'Customized' })).toBeInTheDocument();
    });

    /** Clicks the side of the row's toggle that changes it: "Customize" while inheriting, else "Inherit". */
    const toggle = async (question: string | RegExp) => {
      const row = screen.getByText(question).closest('.grid') as HTMLElement;
      const inheriting = within(row).queryByTestId('inherited-value') !== null;
      await userEvent.click(within(row).getByRole('button', { name: inheriting ? 'Customize' : 'Inherit' }));
    };

    it('customizing the unit also writes its capacity', async () => {
      const toggleInheritance = vi.fn();
      render(
        <Harness
          mode="inheriting"
          values={resolved({ pointsPerPersonDay: 0.3 })}
          toggleInheritance={toggleInheritance}
        />,
      );

      await toggle(UNIT_QUESTION);

      expect(toggleInheritance).toHaveBeenCalledWith('estimateUnit', true, {
        estimateUnit: 'storyPoints',
        pointsPerPersonDay: 0.3,
      });
    });

    it('customizing the capacity also writes the unit', async () => {
      const toggleInheritance = vi.fn();
      render(<Harness mode="inheriting" values={halfTeamWeeks()} toggleInheritance={toggleInheritance} />);

      await toggle(SHARE_QUESTION);

      expect(toggleInheritance).toHaveBeenCalledWith('estimateTeamShare', true, {
        estimateUnit: 'teamWeeks',
        estimateTeamShare: 'half',
      });
    });

    it('inheriting the unit clears the capacity with it', async () => {
      const toggleInheritance = vi.fn();
      const saved = { ...createEmptyConfiguration(), estimateUnit: 'teamWeeks' as const, pointsPerPersonDay: 1 / 25 };
      render(
        <Harness mode="inheriting" values={halfTeamWeeks()} saved={saved} toggleInheritance={toggleInheritance} />,
      );

      await toggle(UNIT_QUESTION);

      expect(toggleInheritance).toHaveBeenCalledWith('estimateUnit', false, {
        estimateUnit: null,
        pointsPerPersonDay: null,
        velocityPerSprint: null,
        estimateTeamShare: null,
      });
    });

    it('a level with only a legacy velocity counts as customizing its capacity', () => {
      render(
        <Harness
          mode="inheriting"
          values={resolved({ velocityPerSprint: 30 })}
          saved={{ ...createEmptyConfiguration(), velocityPerSprint: 30 }}
        />,
      );

      expect(pointsInput()).toHaveValue(30);
    });

    it('customizing a never-entered headcount re-anchors X', async () => {
      const toggleInheritance = vi.fn();
      render(
        <Harness
          mode="inheriting"
          values={resolved({ teamMembers: 5, velocityPerSprint: 21 })}
          toggleInheritance={toggleInheritance}
          hasSavedHeadcount={false}
        />,
      );

      await toggle(MEMBERS_QUESTION);

      const [field, customize, alsoWrite] = toggleInheritance.mock.calls[0];
      expect([field, customize]).toEqual(['teamMembers', true]);
      expect(alsoWrite.pointsPerPersonDay).toBeCloseTo(0.42);
    });
  });
});
