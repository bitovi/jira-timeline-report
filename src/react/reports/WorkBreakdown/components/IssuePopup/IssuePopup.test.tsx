import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { IssuePopup } from './IssuePopup';
import type { IssueOrRelease } from '../../types';

const d = (s: string) => new Date(s);

const onTrackIssue: IssueOrRelease = {
  key: 'OUT-142',
  summary: '100 Stores',
  type: 'Epic',
  url: 'https://example.atlassian.net/browse/OUT-142',
  rollupStatuses: {
    rollup: { status: 'ontrack', start: d('2025-02-12'), due: d('2025-03-09') },
    dev: {
      status: 'complete',
      start: d('2025-02-12'),
      due: d('2025-02-28'),
      issueKeys: ['S-1', 'S-2'],
      startFrom: { message: 'sprint start', reference: { url: 'https://x/S-1', summary: 'Digital menu board' } },
      dueTo: { message: 'due date', reference: { url: 'https://x/S-3', summary: 'Delivery aggregators' } },
    },
    qa: { status: 'behind', due: d('2025-03-09'), start: d('2025-03-01'), issueKeys: ['S-1'] },
    uat: { status: 'unknown', due: null, issueKeys: [] },
  },
};

const behindIssue: IssueOrRelease = {
  key: 'OUT-88',
  summary: 'Digital Channel sales',
  type: 'Epic',
  rollupStatuses: {
    rollup: {
      status: 'behind',
      start: d('2025-06-05'),
      due: d('2025-07-24'),
      lastPeriod: { due: d('2025-06-19') },
      statusFrom: { message: 'Dev slipped 5 weeks vs last period', warning: true },
    },
  },
};

const planningIssue: IssueOrRelease = {
  key: 'PLAN-9',
  summary: 'National menu rollout (planning)',
  type: 'Epic',
  rollupStatuses: {
    rollup: { status: 'notstarted' },
  },
};

function renderPopup(issue: IssueOrRelease, onClose = vi.fn()) {
  const anchorEl = document.createElement('button');
  document.body.appendChild(anchorEl);
  const utils = render(<IssuePopup issue={issue} anchorEl={anchorEl} onClose={onClose} />);
  return { ...utils, anchorEl, onClose };
}

describe('IssuePopup', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  test('renders the header type badge, key, and title link', () => {
    renderPopup(onTrackIssue);
    expect(screen.getByText('Epic')).toBeTruthy();
    expect(screen.getByText('OUT-142')).toBeTruthy();
    const title = screen.getByText('100 Stores');
    expect(title.getAttribute('href')).toBe('https://example.atlassian.net/browse/OUT-142');
  });

  test('renders the overall status/date range once, in the subheader', () => {
    renderPopup(onTrackIssue);
    expect(screen.getByText('On track')).toBeTruthy();
    expect(screen.getByText('Feb 12 – Mar 9')).toBeTruthy();
  });

  test('shows a warning banner only when the rollup has a warning', () => {
    renderPopup(behindIssue);
    expect(screen.getByText('Dev slipped 5 weeks vs last period')).toBeTruthy();
  });

  test('does not show a warning banner when there is none', () => {
    renderPopup(onTrackIssue);
    expect(screen.queryByText(/slipped/)).toBeNull();
  });

  test('shows an N/A row for work types with no work', () => {
    renderPopup(onTrackIssue);
    expect(screen.getByText('No UAT work on this epic')).toBeTruthy();
  });

  test('shows the always-visible start/due detail for a work-type row', () => {
    renderPopup(onTrackIssue);
    expect(screen.getByText('Digital menu board')).toBeTruthy();
    expect(screen.getByText('Delivery aggregators')).toBeTruthy();
    expect(screen.getByText('sprint start')).toBeTruthy();
  });

  test('shows the "nothing to roll up" message for a planning issue with no data', () => {
    renderPopup(planningIssue);
    expect(screen.getByText(/nothing to roll up/)).toBeTruthy();
    expect(screen.queryByText(/No .* work on this epic/)).toBeNull();
  });

  test('omits "Open in Jira" when the issue has no url', () => {
    renderPopup(behindIssue);
    expect(screen.queryByText('Open in Jira ↗')).toBeNull();
  });

  test('shows "Open in Jira" linking to issue.url when present', () => {
    renderPopup(onTrackIssue);
    const link = screen.getByText('Open in Jira ↗');
    expect(link.getAttribute('href')).toBe('https://example.atlassian.net/browse/OUT-142');
  });

  test('"Explore children" links to the explore URL for the issue key', () => {
    renderPopup(onTrackIssue);
    const link = screen.getByText('Explore children →');
    const href = link.getAttribute('href') ?? '';
    expect(href).toContain('jql=issue+%3D+OUT-142');
    expect(href).toContain('loadChildren=true');
  });

  test('clicking the close button calls onClose', () => {
    const { onClose } = renderPopup(onTrackIssue);
    fireEvent.click(screen.getByLabelText('Close'));
    expect(onClose).toHaveBeenCalled();
  });

  test('pressing Escape calls onClose', () => {
    const { onClose } = renderPopup(onTrackIssue);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking outside the popup and anchor calls onClose', () => {
    const { onClose } = renderPopup(onTrackIssue);
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  test('clicking inside the popup does not call onClose', () => {
    const { onClose } = renderPopup(onTrackIssue);
    fireEvent.mouseDown(screen.getByText('100 Stores'));
    expect(onClose).not.toHaveBeenCalled();
  });

  test('clicking the anchor element does not call onClose', () => {
    const { onClose, anchorEl } = renderPopup(onTrackIssue);
    fireEvent.mouseDown(anchorEl);
    expect(onClose).not.toHaveBeenCalled();
  });
});
