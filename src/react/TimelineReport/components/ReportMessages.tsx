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
