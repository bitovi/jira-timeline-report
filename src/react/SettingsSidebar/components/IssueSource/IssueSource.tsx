import type { FC } from 'react';
import type { ExcludedStatusSelectOption } from './components/ExcludedStatusSelect';

import React, { useMemo } from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';

import { useJQL } from './hooks/useJQL';
import { useRawIssuesRequestData } from './hooks/useRawIssueRequestData';
import { useAsyncFeatures } from '../../../services/features';
import JQLTextArea from './components/JqlTextArea';
import LoadChildren from './components/LoadChildren';
import LoadBlockers from './components/LoadBlockers';
import ExcludedStatusSelect from './components/ExcludedStatusSelect';

interface IssueSourceProps {}

const IssueSource: FC<IssueSourceProps> = () => {
  const issueRequestData = useRawIssuesRequestData();
  // Non-suspense, matching SettingsSidebar — this subtree must not suspend on a settings panel.
  // The flag hides the CONTROL only; a URL carrying `loadBlockers=true` still loads blockers.
  // See spec/036-load-blockers-recursiveley §5.
  const { features } = useAsyncFeatures();

  const {
    jql,
    setJql,
    childJql,
    setChildJql,
    applyJql,
    statusesToExclude,
    loadChildren,
    setStatusesToExclude,
    applyButtonEnabled,
    setLoadChildren,
    blockerJql,
    setBlockerJql,
    loadBlockers,
    setLoadBlockers,
  } = useJQL();

  const statusesToExcludeOptions = useMemo(() => toOptions(statusesToExclude), [statusesToExclude]);

  const handleExcludedStatusChange = (statusesToExcludeOptions: Readonly<ExcludedStatusSelectOption[]>) => {
    const statusesToExclude = statusesToExcludeOptions.map((option) => option.value);
    setStatusesToExclude(statusesToExclude);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-4">
        <Heading size="medium">Issue Source</Heading>
      </div>
      <p>Specify a JQL that loads all the issues needed for your report.</p>
      <JQLTextArea jql={jql} setJql={setJql} {...issueRequestData} />
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
      <ExcludedStatusSelect
        label="Exclude statuses"
        placeholder="Select statuses"
        value={statusesToExcludeOptions}
        onChange={handleExcludedStatusChange}
      />
      <div className="flex flex-row justify-end mt-2">
        <Button appearance="primary" isDisabled={!applyButtonEnabled} onClick={applyJql}>
          Apply
        </Button>
      </div>
    </div>
  );
};

export default IssueSource;

const toOptions = (statuses: string[]) => {
  return statuses.map((status) => ({
    label: status,
    value: status,
  }));
};
