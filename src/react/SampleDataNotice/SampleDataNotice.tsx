import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';
import SectionMessage from '@atlaskit/section-message';

import { useCanObservable } from '../hooks/useCanObservable';

interface SampleDataNoticeProps {
  shouldHideNoticeObservable: CanObservable<boolean>;
  onLoginClicked: () => void;
}

/**
 * The product tour for a visitor who hasn't connected Jira, over the sample dataset.
 *
 * **Only reports that are `onByDefault: true` in `configuration/reports.ts` belong here** — the
 * Scatter Plot and the Gantt Chart today. A report still behind a feature flag is one most visitors
 * couldn't turn on if they wanted it, so showcasing it sells something they can't have. Add a link
 * when a report graduates, not when it ships behind a flag.
 *
 * The first two used to pair their chart with a `secondaryReportType` card board rendered below it.
 * That slot is gone and its report (Cards) is behind `cardsReport`, so they are now just the chart.
 * Rewriting them here rather than letting the boot migration rewrite them also keeps anonymous
 * visitors off the document path: that migration turns a secondary-slot config into a
 * report-of-reports, and a document calls `useAllReports` — a suspense query against storage that a
 * logged-out visitor has no reason to make. See spec/018-card-report/alt-plan.md § Delete the slot.
 *
 * `primaryIssueType` is deliberately absent. It became a derived getter off `selectedIssueType`
 * (`route-data.js`), so the `primaryIssueType=Release` these links used to carry had stopped meaning
 * anything — the titles said "Release" while the links rendered Initiatives.
 */
const exampleReports = [
  {
    title: 'Initiative end dates',
    href: '?hideUnknownInitiatives=true&primaryReportType=due&selectedIssueType=Initiative',
  },
  {
    title: 'Initiative timeline',
    href: '?hideUnknownInitiatives=true&primaryReportType=start-due&selectedIssueType=Initiative',
  },
  {
    title: 'Ready and in-development initiative work breakdown',
    href: '?hideUnknownInitiatives=true&primaryReportType=start-due&primaryReportBreakdown=true&selectedIssueType=Initiative',
  },
];

const SampleDataNotice: FC<SampleDataNoticeProps> = ({ onLoginClicked, shouldHideNoticeObservable }) => {
  const shouldHideNotice = useCanObservable(shouldHideNoticeObservable);

  if (shouldHideNotice) {
    return null;
  }

  return (
    <SectionMessage
      // Work around to achieve the design from Figma. `title` is typed string but used like ReactNode.
      // @ts-expect-error
      title={
        <>
          Welcome! You're currently viewing a sample report. To generate a custom status report, click{' '}
          <a className="text-blue-400 cursor-pointer" onClick={onLoginClicked}>
            Connect to Jira
          </a>
        </>
      }
      appearance="warning"
    >
      <p>Checkout the sample reports:</p>
      <ul className="list-disc list-inside ml-2">
        {exampleReports.map((report) => (
          <li key={report.title}>
            <a className="text-blue-400" href={report.href}>
              {report.title}
            </a>
          </li>
        ))}
      </ul>
    </SectionMessage>
  );
};

export default SampleDataNotice;
