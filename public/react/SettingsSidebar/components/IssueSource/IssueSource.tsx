import type { ExcludedStatusSelectOption } from "./components/ExcludedStatusSelect";

import React, { useMemo, FC } from "react";
import Button from "@atlaskit/button/new";

import routeData from "../../../../canjs/routing/route-data";
import ExcludedStatusSelect from "./components/ExcludedStatusSelect";
import { useRawIssuesRequestData } from "./hooks/useRawIssueRequestData";
import { useJQL } from "./hooks/useJQL";

interface IssueSourceProps {}

const IssueSource: FC<IssueSourceProps> = () => {
  const { issuesPromise, isLoading, isSuccess, numberOfIssues, receivedChunks, totalChunks } =
    useRawIssuesRequestData();

  const {
    jql,
    setJql,
    childJQL,
    setChildJQL,
    applyJql,
    statusesToExclude,
    loadChildren,
    setStatusesToExclude,
    applyButtonEnabled,
  } = useJQL();

  const statusesToExcludeOptions = useMemo(() => toOptions(statusesToExclude), [statusesToExclude]);

  const handleExcludedStatusChange = (
    statusesToExcludeOptions: Readonly<ExcludedStatusSelectOption[]>
  ) => {
    const statusesToExclude = statusesToExcludeOptions.map((option) => option.value);
    setStatusesToExclude(statusesToExclude);
  };

  return (
    <>
      <h3 className="h3">Issue Source</h3>
      <p>
        Specify a JQL that loads all issues you want to report on and help determine the timeline of
        your report.
      </p>
      <p>
        <textarea
          className="w-full-border-box mt-2 form-border p-1"
          value={jql}
          onChange={(ev) => setJql(ev.target.value)}
        />
      </p>
      {issuesPromise?.isRejected && (
        <div className="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
          <p>There was an error loading from Jira!</p>
          <p>Error message: {issuesPromise.reason.errorMessages[0]}</p>
          <p>Please check your JQL is correct!</p>
        </div>
      )}
      <div className="flex flex-col justify-between mt-1">
        <p className="text-xs flex flex-col">
          <span>
            <input
              type="checkbox"
              name="loadChildren"
              className="self-start align-middle h-6 mr-0.5"
              checked={routeData.loadChildren}
              onChange={(ev) => (routeData.loadChildren = ev.target.checked)}
            />{" "}
            <label
              htmlFor="loadChildren"
              className="align-middle h-6"
              style={{ lineHeight: "26px" }}
            >
              Load children.{" "}
            </label>
          </span>
          <span className="align-middle h-6">
            {loadChildren && (
              <>
                Optional children JQL filters:{" "}
                <input
                  type="text"
                  className="form-border p-1 h-5"
                  value={childJQL}
                  onChange={(ev) => setChildJQL(ev.target.value)}
                />
              </>
            )}
          </span>
        </p>
        <p className="text-xs" style={{ lineHeight: "26px" }}>
          {isLoading &&
            (totalChunks ? (
              <>
                Loaded {receivedChunks} of {totalChunks} issues
              </>
            ) : (
              <>Loading issues ...</>
            ))}
          {isSuccess && <>Loaded {numberOfIssues} issues</>}
        </p>
      </div>
      <ExcludedStatusSelect
        label="Statuses to exclude from all issue types"
        placeholder="Select statuses"
        value={statusesToExcludeOptions}
        onChange={handleExcludedStatusChange}
      />

      <div className="flex flex-row justify-end mt-2">
        <Button appearance="primary" isDisabled={!applyButtonEnabled} onClick={applyJql}>
          <span className="text-sm">Apply</span>
        </Button>
      </div>
    </>
  );
};

export default IssueSource;

const toOptions = (statuses: string[]) => {
  return statuses.map((status) => ({
    label: status,
    value: status,
  }));
};
