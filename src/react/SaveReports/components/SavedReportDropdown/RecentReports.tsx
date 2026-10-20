import type { FC } from 'react';
import type { Report } from '../../../../jira/reports';

import React from 'react';

import { DropdownItem, DropdownItemGroup } from '@atlaskit/dropdown-menu';
import Hr from '../../../components/Hr';
import { Link } from '../../../services/routing';

interface RecentReportsProps {
  recentReports: Report[];
  onViewReportsButtonClicked: () => void;
  setIsOpen: (isOpen: boolean) => void;
}

/** Most recent first, the same reports home's "Recent reports" shows. See `resolveRecentReports`. */
const RecentReports: FC<RecentReportsProps> = ({ recentReports, onViewReportsButtonClicked, setIsOpen }) => {
  return (
    <>
      <DropdownItemGroup>
        <p className="p-4 text-xs text-slate-400 font-semibold uppercase">Recent</p>
        {recentReports.map((report) => (
          <ReportListItem key={report.id} report={report} />
        ))}
      </DropdownItemGroup>
      <Hr className="!my-1" />
      <DropdownItemGroup>
        <DropdownItem
          onClick={(event) => {
            // needed to not interfere with can routing
            event.stopPropagation();

            onViewReportsButtonClicked();
            setIsOpen(false);
          }}
        >
          View all saved reports
        </DropdownItem>
      </DropdownItemGroup>
    </>
  );
};

export default RecentReports;

const ReportListItem: FC<{ report: Report }> = ({ report }) => {
  return (
    <DropdownItem
      key={report.id}
      // @ts-expect-error types for component overrides on ADS don't work
      component={Link}
      href={'?report=' + report.id}
    >
      {report.name}
    </DropdownItem>
  );
};
