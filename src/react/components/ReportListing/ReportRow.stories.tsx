import type { Meta, StoryObj } from '@storybook/react-vite';
import type { Report } from '../../../jira/reports';

import React, { useState } from 'react';
import ShowMoreHorizontalIcon from '@atlaskit/icon/core/show-more-horizontal';
import Textfield from '@atlaskit/textfield';
import { IconButton } from '@atlaskit/button/new';

import { describeReport } from './describe-report';
import { ReportRow } from './ReportRow';
import { useReportSearch } from './useReportSearch';

const meta: Meta<typeof ReportRow> = {
  title: 'components/ReportListing/ReportRow',
  component: ReportRow,
};

export default meta;

type Story = StoryObj<typeof ReportRow>;

const report = (id: string, name: string, primaryReportType: string, jql = ''): Report => ({
  id,
  name,
  queryParams: new URLSearchParams({ primaryReportType, ...(jql ? { jql } : {}) }).toString(),
});

const SAMPLE_REPORTS: Report[] = [
  report('1', 'All Outcomes', 'start-due', 'issueType = Outcome ORDER BY Rank'),
  report('2', 'All Outcomes copy', 'start-due', 'issueType = Outcome ORDER BY Rank'),
  report('3', 'ECom — In Progress Initiatives', 'due', 'project = ECOM AND status = "In Progress"'),
  report('4', 'Arthur simple table', 'table'),
  report('5', 'Q3 Flow Metrics', 'flow-metrics', 'project = ECOM'),
  report('6', 'Cycle time by status', 'time-in-status'),
  report('7', 'arthur test report of reports', 'report-of-reports'),
  report('8', 'Retired grouper view', 'grouper'),
];

/** A single picker row — what the Add Report modal renders. */
export const PickerRow: Story = {
  render: () => (
    <div className="w-[640px] p-4">
      <ReportRow described={describeReport(SAMPLE_REPORTS[2])} onSelect={() => {}} />
    </div>
  ),
};

/** A manage row — a link plus a trailing menu that sits outside the link. */
export const ManageRow: Story = {
  render: () => (
    <div className="w-[640px] p-4">
      <ReportRow
        described={describeReport(SAMPLE_REPORTS[2])}
        href="?report=3"
        trailing={<IconButton icon={ShowMoreHorizontalIcon} label="manage report" />}
      />
    </div>
  ),
};

/** Every tone at once, including the neutral fallback for an unrecognized type. */
export const EveryReportType: Story = {
  render: () => (
    <ul className="w-[640px] p-4">
      {SAMPLE_REPORTS.map((r) => (
        <li key={r.id}>
          <ReportRow described={describeReport(r)} onSelect={() => {}} />
        </li>
      ))}
    </ul>
  ),
};

const SearchableList = ({ withManageMenu }: { withManageMenu: boolean }) => {
  const [selected, setSelected] = useState('');
  const { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(SAMPLE_REPORTS, {
    onActivate: (r) => setSelected(r.name),
  });

  return (
    <div className="w-[640px] p-4">
      <Textfield
        placeholder="Search reports by name or type…"
        aria-label="Search reports"
        value={query}
        onChange={(event) => setQuery(event.currentTarget.value)}
        onKeyDown={handleKeyDown}
      />
      {filtered.length === 0 ? (
        <p className="py-4 text-center text-slate-500">
          <strong className="block text-neutral-800">No reports match &quot;{query}&quot;</strong>
          Try a different name, or a report type like &quot;gantt&quot; or &quot;table&quot;.
        </p>
      ) : (
        <ul className="flex flex-col py-1">
          {filtered.map((described, index) => (
            <li key={described.report.id}>
              <ReportRow
                described={described}
                query={query}
                isActive={index === activeIndex}
                onMouseEnter={() => setActiveIndex(index)}
                {...(withManageMenu
                  ? {
                      href: `?report=${described.report.id}`,
                      trailing: (
                        <IconButton icon={ShowMoreHorizontalIcon} label={`manage report, ${described.report.name}`} />
                      ),
                    }
                  : { onSelect: () => setSelected(described.report.name) })}
              />
            </li>
          ))}
        </ul>
      )}
      {selected && <p className="pt-2 text-xs text-neutral-300">Selected: {selected}</p>}
    </div>
  );
};

/** The Add Report modal's body: search over the rows, ↑/↓/↵ to pick. */
export const PickerList: Story = {
  render: () => <SearchableList withManageMenu={false} />,
};

/** The Saved Reports page's body: the same rows, as links, each with a manage menu. */
export const ManageList: Story = {
  render: () => <SearchableList withManageMenu />,
};
