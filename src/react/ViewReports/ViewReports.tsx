import type { FC } from 'react';
import type { Report } from '../../jira/reports';

import React, { useMemo, useState } from 'react';
import ShowMoreHorizontalIcon from '@atlaskit/icon/core/show-more-horizontal';
import Textfield from '@atlaskit/textfield';

import DropdownMenu, { DropdownItem } from '@atlaskit/dropdown-menu';
import { IconButton } from '@atlaskit/button/new';

import ViewReportsLayout from './components/ViewReportsLayout';
import { useAllReports, useDeleteReport, useRecentReports } from '../services/reports';
import DeleteReportModal from './components/DeleteReportModal';
import { ReportRow, useReportSearch } from '../components/ReportListing';

interface ViewReportProps {
  onBackButtonClicked: () => void;
}

const ViewReports: FC<ViewReportProps> = ({ onBackButtonClicked }) => {
  const reports = useAllReports();

  const { deleteReport, isDeleting } = useDeleteReport();
  const [managedReport, setManagedReport] = useState<Report>();

  const { removeFromRecentReports } = useRecentReports();

  const sortedReports = useMemo(
    () =>
      Object.values(reports)
        .filter((report) => !!report)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [reports],
  );

  const { query, setQuery, filtered, activeIndex, setActiveIndex, handleKeyDown } = useReportSearch(sortedReports);

  const selectedReport = useMemo(() => {
    const params = new URLSearchParams(window.location.search);
    const selectedReport = params.get('report');

    if (!selectedReport) {
      return '';
    }

    return sortedReports.find(({ id }) => id === selectedReport)?.name || '';
  }, [sortedReports]);

  return (
    <>
      <ViewReportsLayout
        onBackButtonClicked={onBackButtonClicked}
        reportInfo={selectedReport ? <p>{selectedReport}</p> : null}
      >
        {sortedReports.length === 0 ? (
          <p className="py-2 text-slate-500">No saved reports yet. Save a report and it will show up here.</p>
        ) : (
          <>
            <div className="pb-2">
              <Textfield
                placeholder="Search reports by name or type…"
                aria-label="Search reports"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
                onKeyDown={handleKeyDown}
              />
            </div>
            <div className="flex-1 overflow-auto">
              {filtered.length === 0 ? (
                <p className="py-4 text-center text-slate-500">
                  <strong className="block text-neutral-800">No reports match &quot;{query}&quot;</strong>
                  Try a different name, or a report type like &quot;gantt&quot; or &quot;table&quot;.
                </p>
              ) : (
                <ul className="flex flex-col">
                  {filtered.map((described, index) => (
                    <li key={described.report.id}>
                      <ReportRow
                        described={described}
                        query={query}
                        isActive={index === activeIndex}
                        onMouseEnter={() => setActiveIndex(index)}
                        href={'?report=' + described.report.id}
                        trailing={
                          <DropdownMenu
                            shouldRenderToParent
                            trigger={({ triggerRef, ...props }) => (
                              <IconButton
                                icon={ShowMoreHorizontalIcon}
                                label={`manage report, ${described.report.name}`}
                                ref={triggerRef}
                                {...props}
                              />
                            )}
                          >
                            <DropdownItem onClick={() => setManagedReport(described.report)}>Delete</DropdownItem>
                          </DropdownMenu>
                        }
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        )}
      </ViewReportsLayout>
      <DeleteReportModal
        isOpen={!!managedReport}
        isDeleting={isDeleting}
        closeModal={() => setManagedReport(undefined)}
        deleteReport={() => {
          if (!managedReport) {
            return;
          }

          deleteReport(managedReport.id, {
            onSuccess: () => {
              removeFromRecentReports(managedReport.id);
            },
            onSettled: () => setManagedReport(undefined),
          });
        }}
        report={managedReport}
      />
    </>
  );
};

export default ViewReports;
