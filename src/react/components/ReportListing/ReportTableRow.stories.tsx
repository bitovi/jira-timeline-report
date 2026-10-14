import type { Meta, StoryObj } from '@storybook/react-vite';
import type { ReportTableRowProps } from './ReportTableRow';

import React, { useState } from 'react';

import { describeReport } from './describe-report';
import { ReportTableRow } from './ReportTableRow';
import { ReportTableHeader } from './ReportTableHeader';
import { SAMPLE_ACCOUNT_IDS, SAMPLE_OWNERS, SAMPLE_REPORTS } from './sample-reports';

const meta: Meta<typeof ReportTableRow> = {
  title: 'components/ReportListing/ReportTableRow',
  component: ReportTableRow,
};

export default meta;

type Story = StoryObj<typeof ReportTableRow>;

const Table = ({ children }: { children: React.ReactNode }) => (
  <div className="bg-neutral-20 p-6">
    <div role="table" aria-label="Saved reports" className="w-[880px] rounded-xl bg-white shadow-sm">
      <ReportTableHeader />
      {children}
    </div>
  </div>
);

const Row = (props: Partial<ReportTableRowProps>) => {
  const [isStarred, setIsStarred] = useState(props.isStarred ?? false);
  const report = SAMPLE_REPORTS[2];

  return (
    <ReportTableRow
      described={describeReport(report)}
      owner={SAMPLE_OWNERS[SAMPLE_ACCOUNT_IDS.grace]}
      href={`?report=${report.id}`}
      {...props}
      isStarred={isStarred}
      onToggleStar={() => setIsStarred((starred) => !starred)}
    />
  );
};

const story = (props: Partial<ReportTableRowProps>): Story => ({
  render: () => (
    <Table>
      <Row {...props} />
    </Table>
  ),
});

export const Plain = story({});

export const Starred = story({ isStarred: true });

/** Your own report: "You", and the delete button on hover. */
export const Mine = story({ isMine: true, owner: SAMPLE_OWNERS[SAMPLE_ACCOUNT_IDS.me], onDelete: () => {} });

export const SomeoneElses = story({ owner: SAMPLE_OWNERS[SAMPLE_ACCOUNT_IDS.ada] });

/** Saved before owners were recorded, or the names couldn't be loaded. */
export const UnknownOwner = story({ owner: undefined, onDelete: () => {} });

export const FormerUser = story({ owner: SAMPLE_OWNERS[SAMPLE_ACCOUNT_IDS.former], onDelete: () => {} });

/** The home page's recents card. */
export const Compact = story({ compact: true });

export const NoJql = story({ showJql: false });

export const WithSearchHighlight = story({ query: 'ecom' });

/** Every type tone at once, including the neutral fallback for an unrecognized type. */
export const EveryReportType: Story = {
  render: () => (
    <Table>
      {SAMPLE_REPORTS.map((report) => (
        <ReportTableRow
          key={report.id}
          described={describeReport(report)}
          owner={report.ownerId ? SAMPLE_OWNERS[report.ownerId] : undefined}
          isMine={report.ownerId === SAMPLE_ACCOUNT_IDS.me}
          isStarred={report.id === '1'}
          onToggleStar={() => {}}
          href={`?report=${report.id}`}
          onDelete={() => {}}
        />
      ))}
    </Table>
  ),
};
