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
const SPRINT_QUESTION = 'How many working days are in a sprint?';
const SHARE_QUESTION = /how much of the team do you assume will work on a single/;
const WEEK_NOTE = 'One week is 5 working days.';
const POINTS_QUESTION = 'How many story points does your team complete per sprint?';
const MEMBERS_QUESTION = 'How many full-time team members are working on your team?';
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
}: {
  mode?: 'global' | 'inheriting';
  values: Configuration;
  saved?: Configuration;
  itemLabel?: ItemLabel | null;
  estimateFieldOptions?: Array<{ value: string; label: string }>;
  update?: () => void;
}) => {
  // The real forms seed `defaultValues` with the inherited data, so an inherited unit is a value too.
  const { register, control } = useForm<Configuration>({ defaultValues: values });

  return (
    <EstimationQuestions
      mode={mode}
      control={control}
      register={register}
      update={update}
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

describe('EstimationQuestions', () => {
  it.each([
    ['storyPoints', [UNIT_QUESTION, SPRINT_QUESTION, POINTS_QUESTION, PARALLEL_QUESTION]],
    ['devDays', [UNIT_QUESTION, MEMBERS_QUESTION, PARALLEL_QUESTION]],
    ['teamDays', [UNIT_QUESTION, SHARE_QUESTION, PARALLEL_QUESTION]],
    ['teamWeeks', [UNIT_QUESTION, SHARE_QUESTION, PARALLEL_QUESTION]],
    ['teamSprints', [UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, PARALLEL_QUESTION]],
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
    const update = vi.fn();
    render(<Harness values={resolved({})} update={update} />);

    chooseUnit('Dev Days');

    expect(update).toHaveBeenCalledWith({ name: 'estimateUnit', value: 'devDays' });
    expect(screen.getByText(MEMBERS_QUESTION)).toBeInTheDocument();
    expect(screen.queryByText(POINTS_QUESTION)).not.toBeInTheDocument();
    expect(summary()).toBe('1 full-time team member. One work item at a time.');
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

    expect(summary()).toBe('40 story points per 10-day sprint. Up to 2 work items in parallel.');

    const [, points] = numberInputs();
    await userEvent.clear(points);
    await userEvent.type(points, '55');

    expect(summary()).toBe('55 story points per 10-day sprint. Up to 2 work items in parallel.');
  });

  describe('the estimate field hint', () => {
    const hint = () => screen.getByTestId('estimate-field-hint').textContent;

    it('names the field the estimates are read from', () => {
      render(
        <Harness
          values={resolved({ estimateField: 'Story points' })}
          estimateFieldOptions={[{ value: 'Story points', label: 'Story points' }]}
        />,
      );

      expect(hint()).toBe('Estimate field is currently set to Story points');
    });

    it('shows the label of a field stored by id', () => {
      render(
        <Harness
          values={resolved({ estimateField: 'customfield_10020' })}
          estimateFieldOptions={[{ value: 'customfield_10020', label: 'Story points (customfield_10020)' }]}
        />,
      );

      expect(hint()).toBe('Estimate field is currently set to Story points (customfield_10020)');
    });

    it('says when no field is set', () => {
      render(<Harness values={resolved({ estimateField: null })} />);

      expect(hint()).toBe('Estimate field is not set');
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
      expect(summary()).toBe('1 full-time team member. Up to 2 Epics in parallel.');
    });
  });

  describe('inheriting mode', () => {
    it('follows an inherited unit, with the field left inheriting', () => {
      render(
        <Harness mode="inheriting" values={resolved({ estimateUnit: 'teamSprints', estimateTeamShare: 'half' })} />,
      );

      expect(shownQuestions()).toEqual([UNIT_QUESTION, SPRINT_QUESTION, SHARE_QUESTION, PARALLEL_QUESTION].map(String));
      expect(summary()).toBe(
        'Estimates are based on 10-day sprints and assume half the team. One work item at a time.',
      );
      expect(screen.getAllByRole('button', { name: /inheriting/ }).length).toBeGreaterThan(0);
    });

    it('keeps each question labelling its input after lifting it above the toggles', () => {
      render(<Harness mode="inheriting" values={resolved({ estimateUnit: 'devDays', teamMembers: 4 })} />);

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
      expect(within(membersRow).getByRole('button', { name: /customized/ })).toBeInTheDocument();
    });
  });
});
