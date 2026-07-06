import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
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
      startFrom: { message: 'sprint start', reference: { url: '#', summary: 'Digital menu board' } },
      dueTo: { message: 'due date', reference: { url: '#', summary: 'Delivery aggregators' } },
    },
    qa: { status: 'behind', due: d('2025-03-09'), start: d('2025-03-01'), issueKeys: ['S-1'] },
    uat: { status: 'unknown', due: null, issueKeys: [] },
  },
};

const behindIssue: IssueOrRelease = {
  key: 'OUT-88',
  summary: 'Digital Channel sales - 5% increase',
  type: 'Epic',
  url: 'https://example.atlassian.net/browse/OUT-88',
  rollupStatuses: {
    rollup: {
      status: 'behind',
      start: d('2025-06-05'),
      due: d('2025-07-24'),
      lastPeriod: { due: d('2025-06-19') },
      statusFrom: { message: 'Dev slipped 5 weeks vs last period', warning: true },
    },
    design: { status: 'complete', start: d('2025-05-01'), due: d('2025-06-05'), issueKeys: ['D-1'] },
    dev: {
      status: 'behind',
      start: d('2025-06-19'),
      due: d('2025-07-24'),
      issueKeys: ['D-1'],
      lastPeriod: { due: d('2025-06-19') },
      startFrom: { message: 'sprint start', reference: { url: '#', summary: 'Shared orders (for offices)' } },
      dueTo: { message: 'estimate slipped 2 sprints', reference: { url: '#', summary: 'Upsell Recommendations' } },
    },
    qa: { status: 'unknown', due: null, issueKeys: [] },
    uat: { status: 'unknown', due: null, issueKeys: [] },
  },
};

const planningIssue: IssueOrRelease = {
  key: 'PLAN-9',
  summary: 'National menu rollout (planning)',
  type: 'Epic',
  url: 'https://example.atlassian.net/browse/PLAN-9',
  rollupStatuses: {
    rollup: { status: 'notstarted' },
  },
};

interface Args {
  issue: IssueOrRelease;
}

/** Anchors the popup below a placeholder button — `IssuePopup` requires a real anchor element. */
const AnchoredPopup: React.FC<Args> = ({ issue }) => {
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
  return (
    <div style={{ paddingTop: 48 }}>
      <button ref={setAnchorEl} className="rounded border border-neutral-40 bg-white px-3 py-1.5 text-sm">
        {issue.summary}
      </button>
      {anchorEl && <IssuePopup issue={issue} anchorEl={anchorEl} onClose={() => {}} />}
    </div>
  );
};

const meta: Meta<Args> = {
  title: 'Reports/WorkBreakdown/IssuePopup',
  render: ({ issue }) => <AnchoredPopup issue={issue} />,
  args: { issue: onTrackIssue },
};
export default meta;

type Story = StoryObj<Args>;

/** Everything on track, with one work type (UAT) having no children yet. */
export const OnTrackWithNAWorkType: Story = { args: { issue: onTrackIssue } };

/** A warning banner plus a slipped date, with several work types having no children yet. */
export const WarningAndSlippedDate: Story = { args: { issue: behindIssue } };

/** A planning epic with no children or estimates — nothing to roll up. */
export const PlanningNoData: Story = { args: { issue: planningIssue } };
