import type { ExcludedStatusSelectOption } from "./components/ExcludedStatusSelect";

import React, { useMemo, FC } from "react";
import Button from "@atlaskit/button/new";
import TextArea from "@atlaskit/textarea";
import Heading from "@atlaskit/heading";
import SectionMessage from "@atlaskit/section-message";
import VisuallyHidden from "@atlaskit/visually-hidden";
import Link from "@atlaskit/link";
import { Checkbox } from "@atlaskit/checkbox";
import Textfield from "@atlaskit/textfield";

import routeData from "../../../../canjs/routing/route-data";
import ExcludedStatusSelect from "./components/ExcludedStatusSelect";
import { useRawIssuesRequestData } from "./hooks/useRawIssueRequestData";
import { useJQL } from "./hooks/useJQL";
import { Accordion, AccordionContent, AccordionTitle } from "../../../components/Accordion";
import { Label } from "@atlaskit/form";
import Hr from "../../../components/Hr";

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
      <div className="flex items-end flex-col">
        <VisuallyHidden>
          <Label htmlFor="jql-text-area">Add your JQL</Label>
        </VisuallyHidden>
        <TextArea
          id="jql-text-area"
          resize="none"
          className="!min-h-72"
          placeholder="issueType in (Epic, Story) order by Rank"
          value={jql}
          onChange={({ target }) => setJql(target.value)}
        />
        <div className="text-xs h-[26px] pt-1">
          {isLoading &&
            (totalChunks ? (
              <>
                Loaded {receivedChunks} of {totalChunks} issues
              </>
            ) : (
              <>Loading issues ...</>
            ))}
          {isSuccess && <>Loaded {numberOfIssues} issues</>}
        </div>
      </div>
      {issuesPromise?.isRejected && (
        <div className="border-solid-1px-slate-900 border-box block overflow-hidden color-text-and-bg-blocked p-1">
          <p>There was an error loading from Jira!</p>
          <p>Error message: {issuesPromise.reason.errorMessages[0]}</p>
          <p>Please check your JQL is correct!</p>
        </div>
      )}

      <ExcludedStatusSelect
        label="Exclude statuses"
        placeholder="Select statuses"
        value={statusesToExcludeOptions}
        onChange={handleExcludedStatusChange}
      />
      <div>
        <Hr />
        <Accordion startsOpen>
          <AccordionTitle>
            <p className="font-semibold">Load children</p>
          </AccordionTitle>
          <AccordionContent>
            <div className="flex flex-col gap-3 py-4">
              <div className="flex gap-1 items-center">
                <Checkbox
                  id="loadChildren"
                  name="loadChildren"
                  className="self-start align-middle h-6 mr-0.5"
                  isChecked={routeData.loadChildren}
                  onChange={(ev) => (routeData.loadChildren = ev.target.checked)}
                />
                <label htmlFor="loadChildren">Load all children of JQL specified issues</label>
              </div>
              {loadChildren && (
                <div className="flex flex-col gap-1">
                  <Label htmlFor="childJQL">Optional children JQL filters</Label>
                  <Textfield
                    type="text"
                    id="childJQL"
                    value={childJQL}
                    onChange={(ev) => {
                      // ADS Textfield components don't have the correct types
                      const target = ev.target as unknown as { value: string };
                      setChildJQL(target.value);
                    }}
                  />
                </div>
              )}
            </div>
          </AccordionContent>
        </Accordion>
        <Hr />
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

const toOptions = (statuses: string[]) => {
  return statuses.map((status) => ({
    label: status,
    value: status,
  }));
};
