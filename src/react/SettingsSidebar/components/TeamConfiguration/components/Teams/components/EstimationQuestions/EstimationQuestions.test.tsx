import type { Configuration } from '../../services/team-configuration';
import type { ItemLabel } from '../../shared/estimation';

import React from 'react';
import { useForm } from 'react-hook-form';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { createEmptyConfiguration } from '../../services/team-configuration';
import { itemLabelFor } from '../../shared/estimation';
import EstimationQuestions from './EstimationQuestions';

const UNIT_QUESTION = /What units do you use to estimate/;
const SPRINT_QUESTION = 'How many weeks are in a sprint?';
const SHARE_QUESTION = /how much of the team do you assume will work on a single/;
const WEEK_NOTE = 'One week is 5 working days.';
const POINTS_QUESTION = 'On average, how many story points does your team complete per sprint?';
const MEMBERS_QUESTION = 'How many full-time developers are working on your team?';
const PARALLEL_QUESTION = /can your team work on in parallel, on average\?/;
const WARNING = /Team members will need to split their time across multiple/;

const ALL_QUESTIONS = [
  UNIT_QUESTION,
  SPRINT_QUESTION,
  SHARE_QUESTION,
  POINTS_QUESTION,
  MEMBERS_QUESTION,
  PARALLEL_QUESTION,
];

const resolved = (overrides: Partial<Configuration>): Configuration => ({
  ...createEmptyConfiguration(),
  sprintLength: 10,
  velocityPerSprint: 21,
  tracks: 1,
  estimateUnit: 'storyPoints',
  teamMembers: 1,
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
}: {
  mode?: 'global' | 'inheriting';
  values: Configuration;
  saved?: Configuration;
  itemLabel?: ItemLabel | null;
  estimateFieldOptions?: Array<{ value: string; label: string }>;
  update?: () => void;
  updateFields?: (patch: Partial<Configuration>) => void;
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
      toggleInheritance={vi.fn()}
      itemLabel={itemLabel}
      estimateFieldOptions={estimateFieldOptions}
    />
  );
};

const shownQuestions = () =>
  ALL_QUESTIONS.filter((question) => screen.queryByText(question) !== null).map((question) => String(question));

const summary = () => screen.getByTestId('estimation-summary').textContent;

/** The number inputs follow the order the questions are asked in. */
const numberInputs = () => screen.getAllByRole('spinbutton');

const chooseUnit = (label: string) => {
  // react-select renders a combobox; picking an option through the DOM needs the menu opened.
  fireEvent.keyDown(screen.getAllByRole('combobox')[0], { key: 'ArrowDown' });
  fireEvent.click(screen.getByText(label));
};

/** The share select is the second combobox, shown only for the team-time units. */
const chooseShare = (label: string) => {
  fireEvent.keyDown(screen.getAllByRole('combobox')[1], { key: 'ArrowDown' });
  fireEvent.click(screen.getByText(label));
};

const parallelInput = () => screen.getByLabelText(PARALLEL_QUESTION);
const membersInput = () => screen.getByLabelText(new RegExp(MEMBERS_QUESTION.replace('?', '\\?')));

describe('EstimationQuestions', () => {
  it.each([
    ['storyPoints', [UNIT_QUESTION, SPRINT_QUESTION, POINTS_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['devDays', [UNIT_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamDays', [UNIT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamWeeks', [UNIT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamSprints', [UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
  ] as const)('%s asks exactly its questions', (unit, questions) => {
    render(<Harness values={resolved({ estimateUnit: unit })} />);

    expect(shownQuestions()).toEqual(questions.map(String));
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

  it('switching unit changes the questions and saves the unit', () => {
    const updateFields = vi.fn();
    render(<Harness values={resolved({})} updateFields={updateFields} />);

    chooseUnit('Dev Days');

    expect(updateFields).toHaveBeenCalledWith({ estimateUnit: 'devDays', tracks: 1 });
    expect(screen.getByText(MEMBERS_QUESTION)).toBeInTheDocument();
    expect(screen.queryByText(POINTS_QUESTION)).not.toBeInTheDocument();
    expect(summary()).toBe('1 full-time developer. One work item at a time.');
  });

  describe('the parallel count follows the other answers', () => {
    it.each([
      ['Half Team', 'half', 2],
      ['One Third Team', 'third', 3],
      ['Quarter Team', 'quarter', 4],
      ['Full Team', 'full', 1],
    ] as const)('%s → %i in parallel', (label, share, tracks) => {
      const updateFields = vi.fn();
      const startingShare = share === 'full' ? 'half' : 'full';
      render(
        <Harness
          values={resolved({ estimateUnit: 'teamWeeks', estimateTeamShare: startingShare, tracks: 7 })}
          updateFields={updateFields}
        />,
      );

      chooseShare(label);

      expect(updateFields).toHaveBeenCalledWith({ estimateTeamShare: share, tracks });
      expect(parallelInput()).toHaveValue(tracks);
    });

    it('Dev Days: one item per developer, set as the headcount is entered', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 1 })}
          updateFields={updateFields}
        />,
      );

      await userEvent.clear(membersInput());
      await userEvent.type(membersInput(), '6');
      await userEvent.tab();

      expect(updateFields).toHaveBeenCalledWith({ teamMembers: '6', tracks: 6 });
      expect(parallelInput()).toHaveValue(6);
    });

    it('Dev Days: a fractional headcount rounds down', async () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', teamMembers: 2, tracks: 1 })}
          updateFields={updateFields}
        />,
      );

      await userEvent.clear(membersInput());
      await userEvent.type(membersInput(), '2.5');
      await userEvent.tab();

      expect(updateFields).toHaveBeenCalledWith({ teamMembers: '2.5', tracks: 2 });
    });

    it('switching to Dev Days uses the headcount already there', () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ teamMembers: 5, tracks: 1 })} updateFields={updateFields} />);

      chooseUnit('Dev Days');

      expect(updateFields).toHaveBeenCalledWith({ estimateUnit: 'devDays', tracks: 5 });
      expect(parallelInput()).toHaveValue(5);
    });

    it('switching to a team-time unit uses the share already chosen', () => {
      const updateFields = vi.fn();
      render(<Harness values={resolved({ estimateTeamShare: 'quarter', tracks: 1 })} updateFields={updateFields} />);

      chooseUnit('Team Weeks');

      expect(updateFields).toHaveBeenCalledWith({ estimateUnit: 'teamWeeks', tracks: 4 });
    });

    it('overwrites a parallel count typed by hand', () => {
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'teamDays', estimateTeamShare: 'full', tracks: 9 })}
          updateFields={updateFields}
        />,
      );

      chooseShare('Half Team');

      expect(parallelInput()).toHaveValue(2);
    });

    it('switching to Story Points leaves the parallel count alone', () => {
      const update = vi.fn();
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'devDays', teamMembers: 5, tracks: 3 })}
          update={update}
          updateFields={updateFields}
        />,
      );

      chooseUnit('Story Points');

      expect(update).toHaveBeenCalledWith({ name: 'estimateUnit', value: 'storyPoints' });
      expect(updateFields).not.toHaveBeenCalled();
      expect(parallelInput()).toHaveValue(3);
    });

    it('a headcount change leaves the parallel count alone when not on Dev Days', async () => {
      const update = vi.fn();
      const updateFields = vi.fn();
      render(
        <Harness
          values={resolved({ estimateUnit: 'teamWeeks', estimateTeamShare: 'half', teamMembers: 2, tracks: 2 })}
          update={update}
          updateFields={updateFields}
        />,
      );

      await userEvent.clear(membersInput());
      await userEvent.type(membersInput(), '8');
      await userEvent.tab();

      expect(update).toHaveBeenCalledWith({ name: 'teamMembers', value: '8' });
      expect(updateFields).not.toHaveBeenCalled();
      expect(parallelInput()).toHaveValue(2);
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

      const [, parallel] = numberInputs();
      await userEvent.clear(parallel);
      await userEvent.type(parallel, '5');

      expect(screen.getByText(WARNING)).toBeInTheDocument();
    });
  });

  it('updates the summary live', async () => {
    render(<Harness values={resolved({ velocityPerSprint: 40, tracks: 2 })} />);

    expect(summary()).toBe('40 story points per 2-week sprint. With 2 work items in parallel.');

    const [, points] = numberInputs();
    await userEvent.clear(points);
    await userEvent.type(points, '55');

    expect(summary()).toBe('55 story points per 2-week sprint. With 2 work items in parallel.');
  });

  describe('sprint length in weeks', () => {
    const sprintWeeksInput = () => screen.getByLabelText(/How many weeks are in a sprint\?/);

    it('shows a stored sprint length of working days as weeks', () => {
      render(<Harness values={resolved({ sprintLength: 10 })} />);

      expect(sprintWeeksInput()).toHaveValue(2);
    });

    it('saves the weeks typed as working days', async () => {
      const update = vi.fn();
      render(<Harness values={resolved({ sprintLength: 10 })} update={update} />);

      await userEvent.clear(sprintWeeksInput());
      await userEvent.type(sprintWeeksInput(), '3');
      await userEvent.tab();

      expect(update).toHaveBeenCalledWith({ name: 'sprintLength', value: 15 });
    });

    it('updates the summary and the unestimated default live', async () => {
      render(<Harness values={resolved({ velocityPerSprint: 40, sprintLength: 10 })} />);

      await userEvent.clear(sprintWeeksInput());
      await userEvent.type(sprintWeeksInput(), '3');

      expect(summary()).toBe('40 story points per 3-week sprint. One work item at a time.');
      expect(screen.getByTestId('unestimated-hint').textContent).toBe(
        'Work items without estimates default to 15 working days.',
      );
    });

    it('shows a sprint length that is not whole weeks as a fraction', () => {
      render(<Harness values={resolved({ sprintLength: 7 })} />);

      expect(sprintWeeksInput()).toHaveValue(1.4);
    });

    it('does not save an emptied field', async () => {
      const update = vi.fn();
      render(<Harness values={resolved({ sprintLength: 10 })} update={update} />);

      await userEvent.clear(sprintWeeksInput());
      await userEvent.tab();

      expect(update).not.toHaveBeenCalled();
    });

    it('labels every number field on the global form with its own question', () => {
      render(<Harness values={resolved({ velocityPerSprint: 40, teamMembers: 6, tracks: 2 })} />);

      expect(screen.getByLabelText(/how many story points/)).toHaveValue(40);
      expect(screen.getByLabelText(/How many full-time developers/)).toHaveValue(6);
      expect(screen.getByLabelText(/can your team work on in parallel/)).toHaveValue(2);
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
        screen.getByText('When estimating, how much of the team do you assume will work on a single work item?'),
      ).toBeInTheDocument();
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
      expect(summary()).toBe('1 full-time developer. With 2 Epics in parallel.');
    });
  });

  describe('inheriting mode', () => {
    it('follows an inherited unit, with the field left inheriting', () => {
      render(
        <Harness mode="inheriting" values={resolved({ estimateUnit: 'teamSprints', estimateTeamShare: 'half' })} />,
      );

      expect(shownQuestions()).toEqual(
        [UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION].map(String),
      );
      expect(summary()).toBe(
        'Estimates are based on 2-week sprints and assume half the team. One work item at a time.',
      );
      expect(screen.getAllByRole('button', { name: 'Inheriting' }).length).toBeGreaterThan(0);
      const unitRow = screen.getByText(UNIT_QUESTION).closest('.grid') as HTMLElement;
      expect(within(unitRow).getByTestId('inherited-value')).toHaveTextContent('Team Sprints');
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
      expect(screen.getByLabelText(new RegExp(MEMBERS_QUESTION.replace('?', '\\?')))).toHaveValue(4);
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
  });
});
