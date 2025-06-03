import type { FC } from 'react';

import React, { useState } from 'react';
import Modal, { ModalBody, ModalFooter, ModalHeader, ModalTransition } from '@atlaskit/modal-dialog';
import DynamicTable from '@atlaskit/dynamic-table';
import { Checkbox } from '@atlaskit/checkbox';
import Button from '@atlaskit/button/new';
import { useMutation } from '@tanstack/react-query';
import { useFlags } from '@atlaskit/flag';
import Spinner from '@atlaskit/spinner';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';
import SuccessIcon from '@atlaskit/icon/core/success';
import SectionMessage from '@atlaskit/section-message';
import Link from '@atlaskit/link';
import { getDatesFromSimulationIssue } from '../../IssueSimulationRow';
import type { StatsUIData } from '../../scheduler/stats-analyzer';
import { useSelectedIssueType } from '../../../../services/issues';
import { useJira } from '../../../../services/jira';
import { useRouteData } from '../../../../hooks/useRouteData';
import routeData from '../../../../../canjs/routing/route-data';
import { Jira } from '../../../../../jira-oidc-helpers';
import type { FieldsData } from '../../../../../jira-oidc-helpers/types';

type LinkedIssue = StatsUIData['simulationIssueResults'][number]['linkedIssue'];

const jiraDataFormatter = new Intl.DateTimeFormat('en-CA', {
  // 'en-CA' uses the YYYY-MM-DD format
  year: 'numeric',
  month: '2-digit', // '2-digit' will ensure month is always represented with two digits
  day: '2-digit', // '2-digit' will ensure day is always represented with two digits
  calendar: 'iso8601', // This specifies usage of the ISO 8601 calendar
  timeZone: 'UTC',
});

class AutoSchedulerSyncError extends Error {
  constructor(
    public screenErrorMessages: { url: string; summary: string; missingKeys: string[] }[],
    public errors: string[],
  ) {
    super([...screenErrorMessages, ...errors].join('\n'));
    this.name = 'AutoSchedulerSyncError';

    this.screenErrorMessages = screenErrorMessages;
    this.errors = errors;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AutoSchedulerSyncError);
    }
  }
}

const updateFromSimulation = async (
  jiraHelpers: Jira,
  issues: Array<LinkedIssue & { dates: ReturnType<typeof getDatesFromSimulationIssue> }>,
) => {
  const { getFieldFor } = await routeData.teamFieldLookUp;

  const allWork = issues.map((workItem) => {
    const startDateField = getFieldFor({
      team: workItem.team.name,
      issueLevel: workItem.hierarchyLevel.toString(),
      field: 'startDateField',
    });

    const dueDateField = getFieldFor({
      team: workItem.team.name,
      issueLevel: workItem.hierarchyLevel.toString(),
      field: 'dueDateField',
    });

    return {
      ...workItem,
      updates: {
        [startDateField]: jiraDataFormatter.format(workItem.dates.startDateWithTimeEnoughToFinish),
        [dueDateField]: jiraDataFormatter.format(workItem.dates.dueDateTop),
      },
    };
  });

  const results = await Promise.allSettled(
    allWork.map(({ updates, ...workItem }) => {
      return jiraHelpers.editJiraIssueWithNamedFields(workItem.issue.key, updates);
    }),
  );

  const errors = results
    .map((result, index) => {
      return {
        result,
        workItem: allWork[index],
      };
    })
    .filter(
      (outcome): outcome is { result: PromiseRejectedResult; workItem: (typeof allWork)[number] } =>
        outcome.result.status === 'rejected',
    );

  if (errors.length) {
    const error = new AutoSchedulerSyncError([], []);

    for (const erroredOutput of errors) {
      const { reason } = erroredOutput.result;
      const { workItem } = erroredOutput;

      if (Array.isArray(reason.errorMessages) && reason.errorMessages.length) {
        error.errors.push(reason.errorMessages[0]);
        continue;
      }

      if ('errors' in reason) {
        const [message] = Object.values(reason.errors as Record<string, string>);

        if (message.includes('It is not on the appropriate screen, or unknown')) {
          error.screenErrorMessages.push({
            summary: workItem.summary,
            url: workItem.url,
            missingKeys: Object.keys(reason.errors),
          });
        } else {
          error.errors.push(message);
        }
        continue;
      }

      error.errors.push('something went wrong');
    }

    throw error;
  }

  return results;
};

function formatDateOrNull(date: Date | null) {
  return date ? jiraDataFormatter.format(date) : null;
}

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
        icon: <SuccessIcon color={token('color.icon.success')} label="success" />,
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

  const jira = useJira();

  const fields = jira.fields as FieldsData; // This must exist by this point for the modal to even be shown.

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
      {} as typeof selectedIssueMap,
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
            <Checkbox isChecked={selectedIssueMap[key]} onChange={({ target }) => setIssue(key, target.checked)} />
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
          content: formatDateOrNull(issue.linkedIssue.startDate),
        },
        {
          key: `${key}-new-start-date`,
          content: formatDateOrNull(dates.startDateWithTimeEnoughToFinish),
        },
        {
          key: `${key}-current-due-date`,
          content: formatDateOrNull(issue.linkedIssue.dueDate),
        },
        {
          key: `${key}-new-due-date`,
          content: formatDateOrNull(dates.dueDateTop),
        },
      ],
    };
  });

  return (
    <Modal onClose={onClose} width="xlarge">
      <ModalHeader>
        <h1>Update {selectedIssueType} Dates</h1>
      </ModalHeader>
      <ModalBody>
        <DynamicTable
          head={{
            cells: [
              {
                key: 'select-all',
                content: <Checkbox isChecked={allSelected} onChange={({ target }) => selectAll(target.checked)} />,
              },
              { key: 'key', content: 'Key' },
              { key: 'summary', content: 'Summary' },
              // { key: "current-story-points", content: "Current Story Points" },
              // { key: "new-story-points", content: "New Story Points" },
              { key: 'current-start-date', content: 'Start Date (Current)' },
              { key: 'new-start-date', content: 'Start Date (New)' },
              { key: 'current-due-date', content: 'Due Date (Current)' },
              { key: 'new-due-date', content: 'Due Date (New)' },
            ],
          }}
          rows={rows}
        />
        {error && (
          <>
            <SectionMessage title="Error" appearance="error">
              <div>
                {error.errors.map((err, i) => (
                  <p key={i}>{err}</p>
                ))}
              </div>
              <div>
                {error.screenErrorMessages.map(({ missingKeys, url, summary }, i) => (
                  <p key={i}>
                    The field{missingKeys.length > 1 ? 's' : ''} (
                    {missingKeys
                      .map((missingKey) => {
                        const field = fields.idMap[missingKey];
                        return field ? field : missingKey;
                      })
                      .join(', ')}
                    ) {missingKeys.length > 1 ? 'are' : 'is'} not on the screen associated with the{' '}
                    <Link href={url} target="_blank">
                      {summary}
                    </Link>{' '}
                    {selectedIssueType}.{' '}
                    <Link
                      target="_blank"
                      href="https://github.com/bitovi/jira-auto-scheduler/wiki/Troubleshooting#a-field-is-not-on-the-appropriate-screen"
                    >
                      Read how to fix it here
                    </Link>
                    .
                  </p>
                ))}
              </div>
            </SectionMessage>
          </>
        )}
      </ModalBody>
      <ModalFooter>
        <Button onClick={onClose}>Cancel</Button>
        <Button appearance="primary" isDisabled={selectedCount === 0 || isPending} onClick={save}>
          {isPending && <Spinner size="small" />}
          {selectedCount === 0
            ? `Select a ${selectedIssueType} to save`
            : `${isPending ? 'Updating' : 'Update'} ${selectedCount} ${selectedIssueType}${selectedCount > 1 ? 's' : ''}`}
        </Button>
      </ModalFooter>
    </Modal>
  );
};

type OptionalProp<T, K extends keyof T> = Omit<T, K> & Partial<Pick<T, K>>;

export default function UpdateModalWrapper({
  onClose: onCloseProp,
  ...rest
}: OptionalProp<UpdateModalProps, 'onClose'>) {
  const [isOpen, setIsOpen] = useRouteData<boolean>('openAutoSchedulerModal');
  const onClose = () => {
    onCloseProp?.();
    setIsOpen(false);
  };

  return <ModalTransition>{isOpen && <UpdateModal {...rest} onClose={onClose} />}</ModalTransition>;
}
