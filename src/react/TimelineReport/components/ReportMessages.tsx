import type { FC } from 'react';
import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import ErrorIcon from '@atlaskit/icon/core/error';
import WarningIcon from '@atlaskit/icon/core/warning';

import LinkButton from '../../components/LinkButton';

/**
 * Presentational view-state messages for the report shell — the non-report states from the old
 * `<timeline-report>` template (loading / empty / error), plus the "choose sources" prompt. Pure markup with explicit props
 * so they can be storied credential-free (the live shell can't easily reach the error states).
 * Markup + classes are copied verbatim from the StacheElement template.
 */

export interface LoadingMessageProps {
  issuesRequested?: number;
  issuesReceived?: number;
}

/** Shown while the issues request is pending; the count line appears once progress is known. */
export const LoadingMessage: FC<LoadingMessageProps> = ({ issuesRequested, issuesReceived }) => (
  <div className="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">
    <p>Loading ...</p>
    {!!issuesRequested && (
      <p>
        Loaded {issuesReceived} of {issuesRequested} issues.
      </p>
    )}
  </div>
);

export interface EmptyResultMessageProps {
  primaryIssueType?: string;
  /** Opens the Sources panel; the button is omitted without it. */
  onOpenSources?: () => void;
}

/**
 * Shown when the request resolved but no primary issues/releases matched. Laid out like
 * `ChooseSourcesMessage` — it's the same "fix your sources" moment, just after a query ran.
 */
export const EmptyResultMessage: FC<EmptyResultMessageProps> = ({ primaryIssueType, onOpenSources }) => {
  const items = primaryIssueType ? `${primaryIssueType} work items` : 'work items';

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
      {/* The old message was a full-bleed warning-orange box; the orange survives here, as the accent. */}
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
        <WarningIcon label="" color="var(--ds-icon-warning)" />
      </span>
      <Heading size="medium">No {items} found</Heading>
      <p className="text-neutral-801">
        Your sources didn't return any {items}.
        <br />
        Check the JQL in Sources, or pick a different primary type in View Settings.
      </p>
      {onOpenSources && (
        <Button appearance="primary" onClick={onOpenSources}>
          Edit sources
        </Button>
      )}
    </div>
  );
};

export interface ErrorMessageProps {
  errorMessage?: string;
  /** Opens the Sources panel; the button is omitted without it (e.g. inside a Report of Reports). */
  onOpenSources?: () => void;
}

export interface UnsupportedReportTypeMessageProps {
  /** The raw, unrecognized `primaryReportType` from the URL or the saved report. */
  reportType: string;
}

/**
 * Shown when the config asks for a report type this build has no entry for — a saved report or link
 * from before a report was renamed or removed. Permanent, not a migration: it is what keeps a
 * migration's eventual deletion from silently substituting a different report (see
 * spec/018-card-report/saved-report-migrations/plan.md § End of life).
 */
export const UnsupportedReportTypeMessage: FC<UnsupportedReportTypeMessageProps> = ({ reportType }) => (
  <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-orange-50">
      <WarningIcon label="" color="var(--ds-icon-warning)" />
    </span>
    <Heading size="medium">This report was saved in a format we no longer support</Heading>
    <p className="text-neutral-801">
      It refers to a report type (<code className="rounded bg-neutral-20 px-1 text-sm">{reportType}</code>) that no
      longer exists.
      <br />
      Pick a report type above to rebuild it, or delete it from Saved Reports.
    </p>
  </div>
);

/**
 * Shown when the request rejected. Licensing never lands here — an unlicensed site still gets its
 * report, and the sidebar's Eggbert shows it instead (Branding.tsx).
 */
export const ErrorMessage: FC<ErrorMessageProps> = ({ errorMessage, onOpenSources }) => (
  <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
    <span className="flex h-12 w-12 items-center justify-center rounded-full bg-red-50">
      <ErrorIcon label="" color="var(--ds-icon-danger)" />
    </span>
    <Heading size="medium">There was an error loading from Jira</Heading>
    {errorMessage && (
      <p className="w-full rounded border border-red-200 bg-red-50 px-3 py-2 text-left text-sm text-red-800">
        {errorMessage}
      </p>
    )}
    <p className="text-neutral-801">Check that the JQL in Sources is correct.</p>
    {onOpenSources && (
      <Button appearance="primary" onClick={onOpenSources}>
        Edit sources
      </Button>
    )}
  </div>
);

export interface ChooseSourcesMessageProps {
  /** The selected report type's display name, e.g. "Gantt Chart". */
  reportTypeName?: string;
  onViewAllReports: () => void;
}

/**
 * Shown once the user has left home to build a report that has no JQL yet. Unlike home, the report
 * controls stay visible above it, so the report type can still be changed. Both Create buttons open
 * Sources beside it, and the sidebar has its own Sources button, so it offers saved reports instead. See
 * spec/041-saved-reports-redesign/phase1/plan.md § 7.
 */
export const ChooseSourcesMessage: FC<ChooseSourcesMessageProps> = ({ reportTypeName, onViewAllReports }) => (
  <div className="mx-auto flex w-full max-w-[640px] flex-col items-center gap-3 py-16 text-center">
    <Heading size="medium">{reportTypeName ? `${reportTypeName} needs work items` : 'Choose work items'}</Heading>
    <p className="text-neutral-801">Choose the work items to report on in Sources.</p>
    <LinkButton type="button" onClick={onViewAllReports} className="text-sm">
      View all saved reports
    </LinkButton>
  </div>
);
