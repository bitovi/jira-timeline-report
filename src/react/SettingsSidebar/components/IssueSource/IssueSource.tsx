import type { FC } from 'react';

import React from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';

import { useJQL } from './hooks/useJQL';
import { useRawIssuesRequestData } from './hooks/useRawIssueRequestData';
import { useAsyncFeatures } from '../../../services/features';
import JQLTextArea from './components/JqlTextArea';
import LoadChildren from './components/LoadChildren';
import LoadBlockers from './components/LoadBlockers';
import LoadOtherWork from './components/LoadOtherWork';
import { useRouteData } from '../../../hooks/useRouteData';
import type { OtherWorkStatus } from '../../../../jira/rollup/work-size/other-work';

interface IssueSourceProps {}

const IssueSource: FC<IssueSourceProps> = () => {
  const issueRequestData = useRawIssuesRequestData();
  // Non-suspense, matching SettingsSidebar — this subtree must not suspend on a settings panel.
  // The flag hides the CONTROL only; a URL carrying `loadBlockers=true` still loads blockers.
  // See spec/036-load-blockers-recursiveley §5.
  const { features } = useAsyncFeatures();
  const [otherWorkStatus] = useRouteData<OtherWorkStatus | undefined>('teamTimeOtherWork');

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
    loadOtherWork,
    setLoadOtherWork,
    otherWorkJql,
    setOtherWorkJql,
  } = useJQL();

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-4">
        <Heading size="medium">Issue Source</Heading>
      </div>
      <p>Specify a JQL that loads all the issues needed for your report.</p>
      <JQLTextArea jql={jql} setJql={setJql} {...issueRequestData} />
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
        {/* spec/046 — behind the Rollup Calculation flag, like the rest of the Work settings */}
        {features?.rollupCalculation && (
          <LoadOtherWork
            loadOtherWork={loadOtherWork}
            setLoadOtherWork={setLoadOtherWork}
            otherWorkJql={otherWorkJql}
            setOtherWorkJql={setOtherWorkJql}
            status={otherWorkStatus}
          />
        )}
      </div>
      <div className="flex flex-row justify-end mt-2">
        <Button appearance="primary" isDisabled={!applyButtonEnabled} onClick={applyJql}>
          Apply
        </Button>
      </div>
    </div>
  );
};

export default IssueSource;
