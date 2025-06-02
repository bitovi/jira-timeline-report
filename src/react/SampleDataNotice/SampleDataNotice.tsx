import type { FC } from 'react';
import type { CanObservable } from '../hooks/useCanObservable';

import React from 'react';
import SectionMessage from '@atlaskit/section-message';

import { useCanObservable } from '../hooks/useCanObservable';

interface SampleDataNoticeProps {
  shouldHideNoticeObservable: CanObservable<boolean>;
  onLoginClicked: () => void;
}

const exampleReports = [
  {
    title: 'Release end dates with initiative status',
    href: '?primaryIssueType=Release&hideUnknownInitiatives=true&primaryReportType=due&secondaryReportType=status',
  },
  {
    title: 'Release timeline with initiative work breakdown',
    href: '?primaryIssueType=Release&hideUnknownInitiatives=true&secondaryReportType=breakdown',
  },
  {
    title: 'Ready and in-development initiative work breakdown',
    href: '?primaryIssueType=Initiative&hideUnknownInitiatives=true&primaryReportType=start-due&primaryReportBreakdown=true',
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
