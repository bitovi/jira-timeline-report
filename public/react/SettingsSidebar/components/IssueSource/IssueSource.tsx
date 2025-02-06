import type { FC } from "react";
import type { ExcludedStatusSelectOption } from "./components/ExcludedStatusSelect";

import React, { useMemo } from "react";
import Button from "@atlaskit/button/new";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import Link from "@atlaskit/link";

import { useJQL } from "./hooks/useJQL";
import { useRawIssuesRequestData } from "./hooks/useRawIssueRequestData";
import JQLTextArea from "./components/JqlTextArea";
import LoadChildren from "./components/LoadChildren";
import ExcludedStatusSelect from "./components/ExcludedStatusSelect";

interface IssueSourceProps {}

const IssueSource: FC<IssueSourceProps> = () => {
  const issueRequestData = useRawIssuesRequestData();

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
  } = useJQL();

  const statusesToExcludeOptions = useMemo(() => toOptions(statusesToExclude), [statusesToExclude]);

  const handleExcludedStatusChange = (
    statusesToExcludeOptions: Readonly<ExcludedStatusSelectOption[]>
  ) => {
    const statusesToExclude = statusesToExcludeOptions.map((option) => option.value);
    setStatusesToExclude(statusesToExclude);
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="pt-4">
        <Heading size="medium">Issue Source</Heading>
      </div>
      <p>
        Specify a JQL that loads all issues you want to report on and help determine the timeline of
        your report.
      </p>
      <SectionMessage appearance="discovery">
        <Link href="https://support.atlassian.com/jira-work-management/docs/use-advanced-search-with-jira-query-language-jql/">
          Learn more
        </Link>{" "}
        about JQL.
      </SectionMessage>
      <JQLTextArea jql={jql} setJql={setJql} {...issueRequestData} />
      <ExcludedStatusSelect
        label="Exclude statuses"
        placeholder="Select statuses"
        value={statusesToExcludeOptions}
        onChange={handleExcludedStatusChange}
      />
      <LoadChildren
        loadChildren={loadChildren}
        setLoadChildren={setLoadChildren}
        childJql={childJql}
        setChildJql={setChildJql}
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
