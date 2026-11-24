import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import LoadOtherWork, { LOAD_OTHER_WORK_LABEL } from './LoadOtherWork';

vi.mock('../JqlEditor', () => ({
  default: ({ query }: { query: string }) => <div data-testid="jql-editor">{query}</div>,
}));

const renderIt = (props: Partial<React.ComponentProps<typeof LoadOtherWork>> = {}) => {
  const setLoadOtherWork = vi.fn();
  render(
    <LoadOtherWork
      loadOtherWork={false}
      setLoadOtherWork={setLoadOtherWork}
      otherWorkJql=""
      setOtherWorkJql={vi.fn()}
      {...props}
    />,
  );
  return setLoadOtherWork;
};

describe('LoadOtherWork', () => {
  it('toggles, with an explanation behind the (?)', async () => {
    const setLoadOtherWork = renderIt();
    await userEvent.click(screen.getByRole('checkbox', { name: LOAD_OTHER_WORK_LABEL }));
    expect(setLoadOtherWork).toHaveBeenCalledWith(true);
    expect(screen.getByRole('button', { name: "About including the team's other overlapping work" })).toBeVisible();
    expect(screen.queryByTestId('jql-editor')).toBeNull();
  });

  it('when on, shows the optional JQL filter and the last result', () => {
    renderIt({
      loadOtherWork: true,
      otherWorkJql: 'labels != report-ignore',
      status: { status: 'done', issues: [], teamCount: 2, failedTeams: [] },
    });
    expect(screen.getByText('Optional overlapping work JQL filters')).toBeVisible();
    expect(screen.getByTestId('jql-editor')).toHaveTextContent('labels != report-ignore');
    expect(screen.getByTestId('other-work-result')).toHaveTextContent('Loaded 0 more epics from 2 teams');
  });

  it('says when it isn’t used because epics aren’t sized by team time', () => {
    renderIt({ loadOtherWork: true, status: { status: 'off' } });
    expect(screen.getByTestId('other-work-result')).toHaveTextContent("epics aren't sized by team time");
  });
});
