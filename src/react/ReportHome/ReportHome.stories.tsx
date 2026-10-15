import type { Meta, StoryObj } from '@storybook/react-vite';

import React, { useState } from 'react';

import { ReportHome } from './ReportHome';
import { SAMPLE_ACCOUNT_IDS, SAMPLE_REPORTS } from '../components/ReportListing/sample-reports';

const meta: Meta<typeof ReportHome> = {
  title: 'ReportHome',
  component: ReportHome,
};

export default meta;

type Story = StoryObj<typeof ReportHome>;

const noop = () => {};

const Home = ({ withRecents }: { withRecents: boolean }) => {
  const [starredIds, setStarredIds] = useState(new Set(['1']));

  return (
    <ReportHome
      recentReports={withRecents ? SAMPLE_REPORTS : []}
      currentAccountId={SAMPLE_ACCOUNT_IDS.me}
      starredIds={starredIds}
      onToggleStar={(report) =>
        setStarredIds((current) => {
          const next = new Set(current);
          next.has(report.id) ? next.delete(report.id) : next.add(report.id);
          return next;
        })
      }
      onViewAllReports={noop}
      onCreateReport={noop}
      onCreateReportOfReports={noop}
      onOpenSources={noop}
    />
  );
};

export const WithRecents: Story = { render: () => <Home withRecents /> };

/** First visit, or every recent report has since been deleted. */
export const NoRecents: Story = { render: () => <Home withRecents={false} /> };
