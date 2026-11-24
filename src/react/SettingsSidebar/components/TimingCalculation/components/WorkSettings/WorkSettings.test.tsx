import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import { OTHER_WORK_OFF_WARNING, otherWorkMessage, WorkSettingsView } from './WorkSettings';
import type { DerivedIssue } from '../../../../../../jira/derived/derive';
import { RawWorkSettings, resolveWorkSettings } from '../../../../../../jira/rollup/work-size/work-settings';

function renderView(raw: RawWorkSettings = {}) {
  const onChange = vi.fn();
  render(<WorkSettingsView settings={resolveWorkSettings(raw)} onChange={onChange} />);
  return onChange;
}

describe('WorkSettingsView', () => {
  it('defaults to date span, then estimate (today’s sizing)', () => {
    renderView();
    expect(screen.getByRole('radio', { name: /Its date span/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: 'Use its estimate' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Use the average size of its level' })).toBeChecked();
  });

  it('picking a sizing resets the fallback to its default', async () => {
    const onChange = renderView();
    await userEvent.click(screen.getByRole('radio', { name: /Team time over its dates/ }));
    expect(onChange).toHaveBeenCalledWith({ sizeBy: 'teamTime', sizeFallback: '' });
  });

  it('stores the primary’s default fallback as empty', async () => {
    const onChange = renderView({ sizeBy: 'estimate', sizeFallback: 'none' });
    await userEvent.click(screen.getByRole('radio', { name: 'Use its date span' }));
    expect(onChange).toHaveBeenCalledWith({ sizeFallback: '' });
    await userEvent.click(screen.getByRole('radio', { name: 'Use team time over its dates' }));
    expect(onChange).toHaveBeenCalledWith({ sizeFallback: 'teamTime' });
  });

  it('dates: "If it has no dates" unchecks to no fallback', async () => {
    const onChange = renderView({ sizeBy: 'dates' });
    await userEvent.click(screen.getByRole('checkbox', { name: 'Use its estimate' }));
    expect(onChange).toHaveBeenCalledWith({ sizeFallback: 'none' });
  });

  it('sets "If it still has no size"', async () => {
    const onChange = renderView();
    await userEvent.click(screen.getByRole('radio', { name: 'Leave it unsized' }));
    expect(onChange).toHaveBeenCalledWith({ missingSize: 'unsized' });
  });

  describe('team time', () => {
    it('shows its options and warns while other work is off', () => {
      renderView({ sizeBy: 'teamTime' });
      expect(screen.getByText('If it has dates but no estimate')).toBeInTheDocument();
      expect(screen.getByRole('checkbox', { name: 'Use its estimate' })).toBeChecked();
      expect(screen.getByText(OTHER_WORK_OFF_WARNING)).toBeInTheDocument();
    });

    it('shows the result line instead of the warning when other work is on', () => {
      render(
        <WorkSettingsView
          settings={resolveWorkSettings({ sizeBy: 'teamTime', teamTimeOtherWork: true })}
          onChange={vi.fn()}
          otherWork={{ status: 'loading', done: 1, total: 3 }}
        />,
      );
      expect(screen.queryByText(OTHER_WORK_OFF_WARNING)).not.toBeInTheDocument();
      expect(screen.getByTestId('other-work-result')).toHaveTextContent(
        "Loading the team's other work… (1 of 3 teams)",
      );
    });

    it('describes the loaded result, its limits, and failed teams', () => {
      const issues = [{}, {}] as DerivedIssue[];
      expect(otherWorkMessage({ status: 'done', issues, teamCount: 3, failedTeams: [] })).toBe(
        "Loaded 2 more epics from 3 teams to size team time. Work without start/due dates or a Team field can't be found.",
      );
      expect(otherWorkMessage({ status: 'done', issues: [], teamCount: 1, failedTeams: ['Atlas'] })).toBe(
        "Loaded 0 more epics from 1 team to size team time. Work without start/due dates or a Team field can't be found. Couldn't load 1 team: Atlas.",
      );
      expect(otherWorkMessage({ status: 'unavailable', reason: 'Nope.' })).toBe('Nope.');
      expect(otherWorkMessage({ status: 'off' })).toBeNull();
    });

    it('has no other-work checkbox (it lives in the Sources tab); the warning points there', () => {
      renderView({ sizeBy: 'teamTime' });
      expect(screen.queryByRole('checkbox', { name: "Include the team's other overlapping work" })).toBeNull();
      expect(screen.getByText(OTHER_WORK_OFF_WARNING)).toHaveTextContent('in the Sources tab');
    });

    it('is hidden for other sizings', () => {
      renderView({ sizeBy: 'dates' });
      expect(screen.queryByText('If it has dates but no estimate')).not.toBeInTheDocument();
      expect(screen.queryByText(OTHER_WORK_OFF_WARNING)).not.toBeInTheDocument();
    });
  });
});
