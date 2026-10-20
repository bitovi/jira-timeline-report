import type { FC } from 'react';
import type { Reports } from '../../../../jira/reports';

import React, { useMemo, useState } from 'react';

import DropdownMenu from '@atlaskit/dropdown-menu';
import EmptyView from './EmptyView';
import RecentReports from './RecentReports';
import { resolveRecentReports } from '../../../services/reports';

interface SavedReportDropdownProps {
  onViewReportsButtonClicked: () => void;
  recentReports: string[];
  reports: Reports;
}

const SavedReportDropdown: FC<SavedReportDropdownProps> = ({
  onViewReportsButtonClicked,
  recentReports: recentIds,
  reports,
}) => {
  // Need to control so not to interfere with can routing
  const [isOpen, setIsOpen] = useState(false);

  const recentReports = useMemo(() => resolveRecentReports(recentIds, reports), [recentIds, reports]);

  return (
    <DropdownMenu
      isOpen={isOpen}
      onOpenChange={() => setIsOpen((prev) => !prev)}
      trigger="Saved reports"
      shouldRenderToParent
    >
      {recentReports.length === 0 ? (
        <EmptyView />
      ) : (
        <RecentReports
          recentReports={recentReports}
          onViewReportsButtonClicked={onViewReportsButtonClicked}
          setIsOpen={setIsOpen}
        />
      )}
    </DropdownMenu>
  );
};

export default SavedReportDropdown;
