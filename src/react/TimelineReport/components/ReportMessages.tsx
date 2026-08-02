import type { FC } from 'react';
import React from 'react';

/**
 * Presentational view-state messages for the report shell — the non-report states from the old
 * `<timeline-report>` template (no-JQL / loading / empty / error). Pure markup with explicit props
 * so they can be storied credential-free (the live shell can't easily reach the error states).
 * Markup + classes are copied verbatim from the StacheElement template.
 */

/** Shown when logged in but no JQL is configured yet. */
export const NoJqlMessage: FC = () => (
  <div className="my-2 p-2 h-780 border-box block overflow-hidden color-bg-white">
    Configure a JQL in the sidebar on the left to get started.
  </div>
);

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
  count: number;
  primaryIssueType?: string;
}

/** Shown when the request resolved but no primary issues/releases matched. */
export const EmptyResultMessage: FC<EmptyResultMessageProps> = ({ count, primaryIssueType }) => (
  <div className="my-2 p-2 h-780 border-box block overflow-hidden color-text-and-bg-warning">
    <p>
      {count} issues of type {primaryIssueType}.
    </p>
    <p>Please check your JQL and the View Settings.</p>
  </div>
);

export interface ErrorMessageProps {
  noLicense: boolean;
  errorMessage?: string;
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
  <div className="my-2 p-2 h-780 border-box block overflow-hidden color-text-and-bg-warning">
    <p>
      <strong>This report was saved in a format we no longer support.</strong>
    </p>
    <p>
      It refers to a report type (<code>{reportType}</code>) that no longer exists. Pick a report type above to rebuild
      it, or delete it from Saved Reports.
    </p>
  </div>
);

/** Shown when the request rejected — either a licensing error or a generic Jira error. */
export const ErrorMessage: FC<ErrorMessageProps> = ({ noLicense, errorMessage }) => (
  <div className="my-2 p-2 h-780 border-box block overflow-hidden color-text-and-bg-blocked">
    {noLicense ? (
      <>
        <h2>No license</h2>
        <p>You must have a license to use this application</p>
      </>
    ) : (
      <>
        <p>There was an error loading from Jira!</p>
        <p>Error message: {errorMessage}</p>
        <p>Please check your JQL is correct!</p>
      </>
    )}
  </div>
);
