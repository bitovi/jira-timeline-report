import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React, { useEffect, useRef, useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import Button from '@atlaskit/button/new';
import { useQueryClient } from '@tanstack/react-query';

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
import { currentAccountIdQuery, useUserServices } from '../services/user';
import { toStoredSections } from '../reports/ReportOfReports/model/sections';
import { storedQueryParams } from './storedQueryParams';
import { detachedSearch } from './detachedSearch';
import { pushUrlSearch } from '../../canjs/routing/state-storage';
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
  const queryClient = useQueryClient();
  const { readCurrentAccountId } = useUserServices();

  // Fetched ahead so the lookup in `handleCreate` is almost always a cache hit. Not a substitute for
  // the guard below: an uncached Forge `getContext()` still takes a moment.
  useEffect(() => {
    void queryClient.prefetchQuery(currentAccountIdQuery(readCurrentAccountId));
  }, [queryClient, readCurrentAccountId]);

  // Covers the whole create, from the first click — `isCreating` only turns on once `createReport`
  // runs, after the account-id lookup. Without it, a second Confirm during the lookup creates a
  // duplicate report under a fresh id, and Cancel closes a modal whose save still lands later. The
  // ref is the guard (state lags a render); the state drives the modal's disabled buttons.
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  const handleCreate = async (name: string) => {
    if (submitting.current) {
      return;
    }

    submitting.current = true;
    setIsSubmitting(true);

    const finishSubmitting = () => {
      submitting.current = false;
      setIsSubmitting(false);
    };

    const id = uuidv4();
    const params = new URLSearchParams({
      ...(storedQueryParams(routeData.serialize()) as Record<string, string>),
      report: id,
    });

    // `sections` is the report-of-reports document tree. Omitted entirely for every other report
    // type, which has none. See spec/016-report-of-reports Phase 3.
    const storedSections = toStoredSections(sections);

    // Read after the report's state is captured above, so nothing can change under the await.
    // Whoever creates the report owns it — "Copy report" comes through here too, so a copy belongs
    // to whoever copied it. Advisory only; see `Report.ownerId`. Omitted when nobody is signed in.
    let ownerId: string | null;

    try {
      ownerId = await queryClient.fetchQuery(currentAccountIdQuery(readCurrentAccountId));
    } catch (error) {
      finishSubmitting();
      throw error;
    }

    // `useCreateReport` only skips the save when the reports cache is empty, which can't happen
    // here: this component suspends on `useAllReports` until it is filled. So `onSettled` always
    // runs and always releases the guard.

    createReport(
      {
        id,
        name,
        queryParams: params.toString(),
        ...(storedSections.length ? { sections: storedSections } : {}),
        ...(ownerId ? { ownerId } : {}),
      },
      {
        onSuccess: () => {
          closeModal();
          addReportToRecents(id);

          const url = new URL(window.location.href);
          url.search = '';
          url.searchParams.set('report', id);
          queryParamObservable.set(url.search);
        },
        onSettled: finishSubmitting,
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

  /**
   * Drops the `report` param, inlining everything the saved report was supplying so the report on
   * screen doesn't change — see {@link detachedSearch}. What's left is an unsaved report: the title
   * and these controls disappear on their own, because `selectedReport` resolves from the param.
   *
   * Written through `pushUrlSearch` rather than the observable directly, because Back *is* the undo
   * here and a plain `set` would be swallowed: the inlined params almost always include `compareTo`,
   * which is on `replaceStateKeys`. Nothing is written to storage either way, and the report stays
   * in the Saved Reports list.
   */
  const detachReport = () => {
    if (!selectedReport) {
      return;
    }

    pushUrlSearch(detachedSearch({ currentSearch: window.location.search, savedReport: selectedReport, sections }));
  };

  return (
    <div className="flex gap-1 justify-between items-center">
      {/* `min-w-0` + `flex-wrap` let this group give up width as the viewport narrows — without it
          its intrinsic width wins and the right-hand group (fullscreen toggle included) is pushed
          past the edge of the container. */}
      <div className="flex gap-3 items-center flex-wrap min-w-0">
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
            detachReport={detachReport}
          />
        </div>
      </div>
      <div className="flex gap-4 items-center shrink-0">
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
        isCreating={isCreating || isSubmitting}
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
