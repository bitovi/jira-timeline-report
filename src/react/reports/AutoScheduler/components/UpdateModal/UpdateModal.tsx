import type { FC } from "react";
import type { StatsUIData } from "../../scheduler/stats-analyzer";

import React, { useState } from "react";

import Modal, {
  ModalBody,
  ModalFooter,
  ModalHeader,
  ModalTransition,
} from "@atlaskit/modal-dialog";
import DynamicTable from "@atlaskit/dynamic-table";
import { Checkbox } from "@atlaskit/checkbox";

import { getDatesFromSimulationIssue } from "../../IssueSimulationRow";
import Button from "@atlaskit/button/new";
import { useSelectedIssueType } from "../../../../services/issues";
import routeData from "../../../../../canjs/routing/route-data";
import { Jira } from "../../../../../jira-oidc-helpers";
import { useMutation } from "@tanstack/react-query";
import { useJira } from "../../../../services/jira";
import Spinner from "@atlaskit/spinner";
import { useFlags } from "@atlaskit/flag";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";
import SuccessIcon from "@atlaskit/icon/core/success";

type LinkedIssue = StatsUIData["simulationIssueResults"][number]["linkedIssue"];

const jiraDataFormatter = new Intl.DateTimeFormat("en-CA", {
  // 'en-CA' uses the YYYY-MM-DD format
  year: "numeric",
  month: "2-digit", // '2-digit' will ensure month is always represented with two digits
  day: "2-digit", // '2-digit' will ensure day is always represented with two digits
  calendar: "iso8601", // This specifies usage of the ISO 8601 calendar
  timeZone: "UTC",
});

class AutoSchedulerSyncError extends Error {
  constructor(public screenErrorMessages: string[], public errors: string[]) {
    super([...screenErrorMessages, ...errors].join("\n"));
    this.name = "AutoSchedulerSyncError";

    this.screenErrorMessages = screenErrorMessages;
    this.errors = errors;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AutoSchedulerSyncError);
    }
  }
}

const updateFromSimulation = async (
  jiraHelpers: Jira,
  issues: Array<LinkedIssue & { dates: ReturnType<typeof getDatesFromSimulationIssue> }>
) => {
  const { getFieldFor } = await routeData.teamFieldLookUp;

  const allWork = issues.map((workItem) => {
    const startDateField = getFieldFor({
      team: workItem.team.name,
      issueLevel: workItem.hierarchyLevel.toString(),
      field: "startDateField",
    });

    const dueDateField = getFieldFor({
      team: workItem.team.name,
      issueLevel: workItem.hierarchyLevel.toString(),
      field: "dueDateField",
    });

    return {
      ...workItem,
      updates: {
        [startDateField]: jiraDataFormatter.format(workItem.dates.startDateWithTimeEnoughToFinish),
        [dueDateField]: jiraDataFormatter.format(workItem.dates.dueDateTop),
      },
    };
  });

  console.log(allWork);

  const results = await Promise.allSettled(
    allWork.map(({ updates, ...workItem }) => {
      return jiraHelpers.editJiraIssueWithNamedFields(workItem.issue.key, updates);
    })
  );

  const errors = results.filter(
    (outcome): outcome is PromiseRejectedResult => outcome.status === "rejected"
  );

  if (errors.length) {
    const error = new AutoSchedulerSyncError([], []);

    for (const { reason } of errors) {
      if (Array.isArray(reason.errorMessages) && reason.errorMessages.length) {
        error.errors.push(reason.errorMessages[0]);
        continue;
      }

      if ("errors" in reason && typeof reason.error === "object") {
        const [message] = Object.values(reason.errors as Record<string, string>);

        if (message.includes("It is not on the appropriate screen, or unknown")) {
          error.screenErrorMessages.push(
            "screen error occurred. we need to handle this at some point"
          );
        } else {
          error.errors.push(message);
        }
        continue;
      }

      error.errors.push("something went wrong");
    }

    throw error;
  }

  return results;
};

const useUpdateIssuesWithSimulationData = () => {
  const jira = useJira();
  const { showFlag } = useFlags();

  const { mutate, isPending, error } = useMutation<
    unknown,
    AutoSchedulerSyncError,
    Parameters<typeof updateFromSimulation>[1]
  >({
    mutationFn: (issues) => updateFromSimulation(jira, issues),
    onSuccess: () => {
      showFlag({
        title: <Text color="color.text.success">Success</Text>,
        description: `Successfully updated`,
        isAutoDismiss: true,
        icon: <SuccessIcon color={token("color.icon.success")} label="success" />,
      });
    },
  });

  return {
    saveIssues: mutate,
    isPending,
    error,
  };
};

interface UpdateModalProps {
  onClose: () => void;
  issues: StatsUIData;
  startDate: Date;
}

const UpdateModal: FC<UpdateModalProps> = ({ onClose, issues, startDate }) => {
  const { selectedIssueType } = useSelectedIssueType();
  const [selectedIssueMap, setSelectedIssueMap] = useState<Record<string, boolean>>({});

  const { saveIssues, isPending, error } = useUpdateIssuesWithSimulationData();

  const save = () => {
    const issuesToSave = issues.simulationIssueResults
      .filter(({ linkedIssue }) => selectedIssueMap[linkedIssue.key])
      .map((issue) => {
        return {
          ...issue.linkedIssue,
          dates: getDatesFromSimulationIssue(issue, startDate),
        };
      });

    saveIssues(issuesToSave, { onSuccess: () => onClose() });
  };

  const selectAll = (newValue: boolean) => {
    const newMapping = issues.simulationIssueResults.reduce(
      (map, { linkedIssue }) => ({ ...map, [linkedIssue.key]: newValue }),
      {} as typeof selectedIssueMap
    );

    setSelectedIssueMap(newMapping);
  };

  const setIssue = (key: string, value: boolean) => {
    setSelectedIssueMap((previous) => ({ ...previous, [key]: value }));
  };

  const selectedCount = Object.values(selectedIssueMap).filter(Boolean).length;
  const allSelected = selectedCount === issues.simulationIssueResults.length;

  const rows = issues.simulationIssueResults.map((issue) => {
    const dates = getDatesFromSimulationIssue(issue, startDate);
    const { key } = issue.linkedIssue;

    return {
      key,
      cells: [
        {
          key: `${key}-select`,
          content: (
            <Checkbox
              label={`Select ${key}`}
              isChecked={selectedIssueMap[key]}
              onChange={({ target }) => setIssue(key, target.checked)}
            />
          ),
        },
        { key: `${key}-key`, content: key },
        { key: `${key}-summary`, content: issue.linkedIssue.summary },
        // {
        //   key: `${key}-current-story-points`,
        //   content: Math.round(issue.linkedIssue.storyPoints || 0),
        // },
        // {
        //   key: `${key}-new-story-points`,
        //   content: Math.round(issue.linkedIssue.derivedTiming.deterministicTotalPoints || 0),
        // },
        {
          key: `${key}-current-start-date`,
          content: issue.linkedIssue.startDate?.toDateString() ?? "",
        },
        {
          key: `${key}-new-start-date`,
          content: dates.startDateWithTimeEnoughToFinish.toDateString(),
        },
        {
          key: `${key}-current-due-date`,
          content: issue.linkedIssue.dueDate?.toDateString() ?? "",
        },
        {
          key: `${key}-new-due-date`,
          content: dates.dueDateTop.toDateString(),
        },
      ],
    };
  });

  return (
    <Modal onClose={onClose} width="xlarge">
      <ModalHeader>
        <h1>save</h1>
      </ModalHeader>
      <ModalBody>
        {error && (
          <>
            <div>
              {error.errors.map((err, i) => (
                <p key={i} className="text-red-500">
                  {err}
                </p>
              ))}
            </div>
            <div>
              {error.screenErrorMessages.map((err, i) => (
                <p key={i} className="text-red-500">
                  {err}
                </p>
              ))}
            </div>
          </>
        )}
        <DynamicTable
          head={{
            cells: [
              {
                key: "select-all",
                content: (
                  <Checkbox
                    label="Select all"
                    isChecked={allSelected}
                    onChange={({ target }) => selectAll(target.checked)}
                  />
                ),
              },
              { key: "key", content: "Key" },
              { key: "summary", content: "Summary" },
              // { key: "current-story-points", content: "Current Story Points" },
              // { key: "new-story-points", content: "New Story Points" },
              { key: "current-start-date", content: "Current Start Date" },
              { key: "new-start-date", content: "New Start Date" },
              { key: "current-due-date", content: "Current Due Date" },
              { key: "new-due-date", content: "New Due Date" },
            ],
          }}
          rows={rows}
        />
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button appearance="primary" isDisabled={selectedCount === 0 || isPending} onClick={save}>
          {isPending && <Spinner size="small" />}
          {selectedCount === 0
            ? `Select a ${selectedIssueType} to save`
            : `Update ${selectedCount} ${selectedIssueType}${selectedCount > 1 ? "s" : ""}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

export default function UpdateModalWrapper({
  isOpen,
  ...rest
}: UpdateModalProps & { isOpen: boolean }) {
  return <ModalTransition>{isOpen && <UpdateModal {...rest} />}</ModalTransition>;
}
