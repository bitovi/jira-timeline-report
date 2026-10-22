import type { FC, ReactNode } from 'react';

import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import InfoIcon from '@atlaskit/icon/glyph/info';

import { useJQL } from './hooks/useJQL';
import { useRawIssuesRequestData } from './hooks/useRawIssueRequestData';
import { useSourceFilterFieldDefinitions } from './hooks/useSourceFilterFieldDefinitions';
import { useSourceFilterRows } from './hooks/useSourceFilterRows';
import { useAsyncFeatures } from '../../../services/features';
import JQLTextArea from './components/JqlTextArea';
import LoadChildren from './components/LoadChildren';
import LoadBlockers from './components/LoadBlockers';
import IssueLoadStatus from './components/IssueLoadStatus';
import { FilterRowsBuilder } from '../../../ReportControls/components/Filters/components/FilterRowsBuilder';

interface IssueSourceProps {}

/**
 * One numbered step of the panel (spec/042-sources-panel-filters, design option 3a): a circled
 * number on a line that runs down to the next step, and the step's content beside it.
 */
const Step: FC<{ number: number; title: string; children: ReactNode; isLast?: boolean }> = ({
  number,
  title,
  children,
  isLast,
}) => (
  <div className="grid grid-cols-[24px_1fr] gap-x-3">
    <div className="flex flex-col items-center">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-neutral-50 text-xs font-semibold">
        {number}
      </span>
      {!isLast && <span className="mt-1 w-px flex-1 bg-neutral-41" />}
    </div>
    <div className={`flex flex-col gap-2 ${isLast ? '' : 'pb-12'}`}>
      <h3 className="text-sm font-semibold leading-6">{title}</h3>
      {children}
    </div>
  </div>
);

const IssueSource: FC<IssueSourceProps> = () => {
  const issueRequestData = useRawIssuesRequestData();
  // Non-suspense, matching SettingsSidebar — this subtree must not suspend on a settings panel.
  // The flag hides the CONTROL only; a URL carrying `loadBlockers=true` still loads blockers.
  // See spec/036-load-blockers-recursiveley §5.
  const { features } = useAsyncFeatures();
  const sourceFilterFieldDefinitions = useSourceFilterFieldDefinitions();
  const { sourceFilterRows, setSourceFilterRows } = useSourceFilterRows();

  const {
    jql,
    setJql,
    childJql,
    setChildJql,
    applyJql,
    loadChildren,
    applyButtonEnabled,
    setLoadChildren,
    blockerJql,
    setBlockerJql,
    loadBlockers,
    setLoadBlockers,
  } = useJQL();

  return (
    <div className="flex flex-col">
      <div className="pt-4 pb-2 flex flex-col gap-1">
        <Heading size="medium">Issue source</Heading>
        <p className="text-sm text-neutral-801">
          Issues are fetched from Jira, filtered here, then sent to the report.
        </p>
      </div>
      <div className="pt-4">
        <Step number={1} title="Query Jira">
          <JQLTextArea
            jql={jql}
            setJql={setJql}
            isLoading={issueRequestData.isLoading}
            helperText="JQL for the issues your report starts from."
          />
        </Step>
        <Step number={2} title="Add related issues">
          <div className="flex flex-col gap-3">
            <LoadChildren
              loadChildren={loadChildren}
              setLoadChildren={setLoadChildren}
              childJql={childJql}
              setChildJql={setChildJql}
            />
            {features?.recursiveBlockers && (
              <LoadBlockers
                loadBlockers={loadBlockers}
                setLoadBlockers={setLoadBlockers}
                blockerJql={blockerJql}
                setBlockerJql={setBlockerJql}
              />
            )}
          </div>
        </Step>
        {/* Its own step because it's the only one that calls Jira, and step 4's options come from it. */}
        <Step number={3} title="Get issues from Jira">
          <div className="flex items-center gap-3">
            <Button appearance="primary" isDisabled={!applyButtonEnabled} onClick={applyJql}>
              Load issues
            </Button>
            <IssueLoadStatus {...issueRequestData} />
          </div>
        </Step>
        <Step number={4} title="Filter loaded issues" isLast>
          <p className="flex items-center gap-1 text-xs text-neutral-801">
            <InfoIcon label="" size="small" />
            Load issues to update the filter options.
          </p>
          <FilterRowsBuilder
            rows={sourceFilterRows}
            onChange={setSourceFilterRows}
            fieldDefinitions={sourceFilterFieldDefinitions}
            layout="stacked"
            addLabel="+ Add rule"
            showClearAll={false}
          />
        </Step>
      </div>
    </div>
  );
};

export default IssueSource;
