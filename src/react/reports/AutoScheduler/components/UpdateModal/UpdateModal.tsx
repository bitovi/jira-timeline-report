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

type LinkedIssue = StatsUIData["simulationIssueResults"][number]["linkedIssue"];

const jiraDataFormatter = new Intl.DateTimeFormat("en-CA", {
  // 'en-CA' uses the YYYY-MM-DD format
  year: "numeric",
  month: "2-digit", // '2-digit' will ensure month is always represented with two digits
  day: "2-digit", // '2-digit' will ensure day is always represented with two digits
  calendar: "iso8601", // This specifies usage of the ISO 8601 calendar
  timeZone: "UTC",
});

const save = (
  issues: Array<LinkedIssue & { dates: ReturnType<typeof getDatesFromSimulationIssue> }>
) => {
  const fieldMap = {};
  const allWork = issues.map((workItem) => {
    return {
      ...workItem,
      updates: {
        ["this.startDateField"]: jiraDataFormatter.format(
          workItem.dates.startDateWithTimeEnoughToFinish
        ),
        ["this.dueDateField"]: jiraDataFormatter.format(workItem.dates.dueDateTop),
      },
    };
  });
};

interface UpdateModalProps {
  onClose: () => void;
  issues: StatsUIData;
  startDate: Date;
}

const UpdateModal: FC<UpdateModalProps> = ({ onClose, issues, startDate }) => {
  const { selectedIssueType } = useSelectedIssueType();
  const [selectedIssueMap, setSelectedIssueMap] = useState<Record<string, boolean>>({});

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
        <Button appearance="primary" isDisabled={selectedCount === 0}>
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
