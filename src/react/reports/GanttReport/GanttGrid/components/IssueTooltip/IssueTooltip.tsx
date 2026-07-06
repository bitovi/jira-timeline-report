import React, { useState } from 'react';
import Popup, { type TriggerProps } from '@atlaskit/popup';
import type { IssueOrRelease, RollupStatus } from '../../types';

const WORK_PARTS = ['rollup', 'dev', 'qa', 'uat'] as const;

function prettyDate(date?: Date | null): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' }).format(date);
}

function buildExploreUrl(issue: IssueOrRelease): string {
  const url = new URL(window.location.href);
  url.searchParams.set('jql', 'issue = ' + issue.key);
  url.searchParams.set('loadChildren', 'true');
  url.searchParams.set('childJQL', '');
  url.searchParams.delete('statusesToShow');
  url.searchParams.delete('statusesToRemove');
  url.searchParams.delete('releasesToShow');
  url.searchParams.delete('groupBy');
  return url.href;
}

const WorkPartSection: React.FC<{ part: (typeof WORK_PARTS)[number]; data: RollupStatus }> = ({ part, data }) => (
  <div className="p-2">
    <div className="flex items-center gap-1">
      <span className={`color-text-and-bg-${data.status} px-1`}>{part.toUpperCase()}</span>
      {data.status !== 'unknown' && (
        <span>
          {prettyDate(data.start)} - {prettyDate(data.due)}
        </span>
      )}
    </div>
    {data.statusData?.warning && <div className="color-bg-warning">{data.statusData.message}</div>}
    {data.status !== 'unknown' && (
      <>
        <p>
          Start:{' '}
          {data.startFrom?.reference?.url ? (
            <a href={data.startFrom.reference.url} target="_blank" rel="noreferrer" className="link">
              {data.startFrom.reference.summary}
            </a>
          ) : null}{' '}
          {data.startFrom?.message}
        </p>
        <p>
          End:{' '}
          {data.dueTo?.reference?.url ? (
            <a href={data.dueTo.reference.url} target="_blank" rel="noreferrer" className="link">
              {data.dueTo.reference.summary}
            </a>
          ) : null}{' '}
          {data.dueTo?.message}
        </p>
      </>
    )}
  </div>
);

export interface IssueTooltipProps {
  issue: IssueOrRelease;
  children: (triggerProps: TriggerProps & { onClick: () => void }) => React.ReactElement;
}

/**
 * Click-triggered popup showing an issue's title, a "Show Children" explore link, and per
 * work-part (rollup/dev/qa/uat) date breakdowns.
 *
 * Ports [issue-tooltip.js](src/canjs/controls/issue-tooltip.js) using `@atlaskit/popup`.
 */
export const IssueTooltip: React.FC<IssueTooltipProps> = ({ issue, children }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Popup
      isOpen={isOpen}
      onClose={() => setIsOpen(false)}
      placement="bottom-start"
      content={() => (
        <div className="max-w-md" data-testid="issue-tooltip">
          <div className="flex items-center p-2 justify-between">
            <a
              className={`text-lg font-bold ${issue.url ? 'link' : ''}`}
              href={issue.url || ''}
              target="_blank"
              rel="noreferrer"
            >
              {issue.summary}
            </a>
            <button type="button" onClick={() => setIsOpen(false)} aria-label="Close">
              ❌
            </button>
          </div>
          <a className="link px-2" href={buildExploreUrl(issue)}>
            Show Children
          </a>
          {issue.rollupStatuses.rollup?.statusData?.warning && (
            <div className="color-bg-warning">{issue.rollupStatuses.rollup.statusData.message}</div>
          )}
          {WORK_PARTS.map((part) => {
            const data = issue.rollupStatuses[part];
            return data ? <WorkPartSection key={part} part={part} data={data} /> : null;
          })}
        </div>
      )}
      trigger={(triggerProps) => children({ ...triggerProps, onClick: () => setIsOpen((open) => !open) })}
    />
  );
};
