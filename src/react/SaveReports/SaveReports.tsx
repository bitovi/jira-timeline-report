import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React, { useEffect, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '@atlaskit/button/new';

import { useAllReports, useCreateReport, useRecentReports } from '../services/reports';
import SaveReportModal from './components/SaveReportModal';
import SavedReportDropdown from './components/SavedReportDropdown';
import FullscreenToggle from './components/FullscreenToggle';
import PrintReportButton from '../ReportControls/components/PrintReportButton';
import ReportControls from './components/ReportControls';
import EditableTitle from './components/EditableTitle';
import { useQueryParams } from '../hooks/useQueryParams';
import { useSelectedReport } from './hooks/useSelectedReports';
import { usePrimaryReportType } from '../ReportControls/hooks/usePrimaryReportType';
import { useReportLayout } from '../services/report-layout';
import { toStoredSections } from '../reports/ReportOfReports/model/sections';
import { storedQueryParams } from './storedQueryParams';
import routeData from '../../canjs/routing/route-data';

interface SaveReportProps {
  onViewReportsButtonClicked: () => void;
  queryParamObservable: CanObservable<string>;
}

const SaveReport: FC<SaveReportProps> = ({ queryParamObservable, onViewReportsButtonClicked }) => {
  const [isOpen, setIsOpen] = useState(false);
  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const reports = useAllReports();
  const [primaryReportType] = usePrimaryReportType();

  const { sections, resetSections } = useReportLayout();

  const { createReport, isCreating } = useCreateReport();
  const { selectedReport, updateSelectedReport, isDirty } = useSelectedReport({
    reports,
    queryParamObservable,
    sections,
  });

  const [name, setName] = useState(selectedReport?.name ?? 'Untitled Report');

  useEffect(() => {
    if (!selectedReport) {
      return;
    }

    setName(selectedReport.name);
  }, [selectedReport]);

  const { recentReports, addReportToRecents } = useRecentReports();

  const { queryParams } = useQueryParams(queryParamObservable, {
    onChange: (params) => {
      const report = params.get('report');

      // TODO: If confirm `report` exists in `reports` before adding
      // TODO: Reconcile deleted reports with whats there

      if (report) {
        addReportToRecents(report);
      }
    },
  });

  const validateName = (name: string) => {
    const match = Object.values(reports).find((report) => report?.name === name);

    return {
      isValid: !match,
      message: !match ? '' : 'That name already exists. Please input a unique report name.',
    };
  };

  const handleCreate = (name: string) => {
    const id = uuidv4();
    const params = new URLSearchParams({
      ...(storedQueryParams(routeData.serialize()) as Record<string, string>),
      report: id,
    });

    // `sections` is the report-of-reports document tree. Omitted entirely for every other report
    // type, which has none. See spec/016-report-of-reports Phase 3.
    const storedSections = toStoredSections(sections);

    createReport(
      { id, name, queryParams: params.toString(), ...(storedSections.length ? { sections: storedSections } : {}) },
      {
        onSuccess: () => {
          closeModal();
          addReportToRecents(id);

          const url = new URL(window.location.href);
          url.search = '';
          url.searchParams.set('report', id);
          queryParamObservable.set(url.search);
        },
      },
    );
  };

  const resetChanges = () => {
    if (!selectedReport) {
      return;
    }

    // The URL reset below restores every param-backed setting, the document tree included — it is
    // a `sections` param now (spec/016-report-of-reports/006-url-state). `resetSections` is still
    // called first so the tree is restored synchronously, rather than depending on the order the
    // provider observes the rewrite in.
    resetSections();
    queryParamObservable.set(`?report=${selectedReport.id}`);
  };

  return (
    <div className="flex gap-1 justify-between items-center">
      <div className="flex gap-3 items-center">
        {selectedReport && (
          <EditableTitle
            key={selectedReport.id}
            name={name}
            setName={setName}
            selectedReport={selectedReport}
            validate={validateName}
          />
        )}
        {/* `contents` keeps this from affecting layout; fullscreen.css and print.css hide it
            (fullscreen mode / printing) so only the report name (above) and the fullscreen
            toggle (below) remain. */}
        <div className="contents report-chrome-hidden">
          <ReportControls
            hasSelectedReport={!!selectedReport}
            isDirty={isDirty}
            updateSelectedReport={updateSelectedReport}
            openModal={openModal}
            resetChanges={resetChanges}
          />
        </div>
      </div>
      <div className="flex gap-4 items-center">
        <div className="contents report-chrome-hidden">
          {/* The `jql` gate is a proxy for "there's something worth saving". A report-of-reports
              never has a `jql` param of its own, so it needs its own clause here.
              See spec/016-report-of-reports. */}
          {!selectedReport && (!!queryParams.get('jql') || primaryReportType === 'report-of-reports') && (
            <Button appearance="primary" onClick={openModal}>
              Create new report
            </Button>
          )}
          <SavedReportDropdown
            onViewReportsButtonClicked={onViewReportsButtonClicked}
            recentReports={recentReports}
            reports={reports}
          />
          <PrintReportButton />
        </div>
        <FullscreenToggle />
      </div>
      <SaveReportModal
        isOpen={isOpen}
        isCreating={isCreating}
        closeModal={closeModal}
        name={name}
        setName={setName}
        onCreate={handleCreate}
        validate={validateName}
      />
    </div>
  );
};

export default SaveReport;
