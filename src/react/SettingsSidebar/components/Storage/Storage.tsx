import type { FC } from 'react';
import type { StorageOption, StorageOptionValue } from './components/StorageCard';

import React, { useId, useState } from 'react';
import { useDebounce } from '../../../hooks/useDebounce';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';
import SuccessIcon from '@atlaskit/icon/core/success';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';
import { useFlags } from '@atlaskit/flag';
import SectionMessage from '@atlaskit/section-message';
import Select from '@atlaskit/select';
import Spinner from '@atlaskit/spinner';
import Textfield from '@atlaskit/textfield';
import { ErrorMessage, HelperMessage, Label } from '@atlaskit/form';

import StorageCard from './components/StorageCard';
import MigrateReportsModal from './components/MigrateReportsModal';
import { useJira } from '../../../services/jira';
import {
  useMigrateReports,
  useReportsStorageConfig,
  useSaveReportsStorageConfig,
  useSpaceIssueTypes,
} from '../../../services/reports-storage';

const CONNECT_OPTIONS: StorageOption[] = [
  { value: 'legacy', label: 'Key/Value', description: 'One app property holding every saved report.' },
  { value: 'space', label: 'Reports Space', description: 'One Jira work item per saved report.' },
];

const WEB_OPTIONS: StorageOption[] = [
  {
    value: 'legacy',
    label: 'Configuration Issue',
    description: 'One code block holding every saved report.',
  },
  { value: 'space', label: 'Reports Space', description: 'One Jira work item per saved report.' },
];

type IssueTypeOption = { label: string; value: string };

/**
 * Where this site's saved reports live.
 *
 * Two cards, one per host, and only the card for the host you are running in is editable — the web
 * build cannot read a Connect app property, so the other card documents rather than reports. Point
 * both hosts at the same space and they share the same saved reports, which is the one arrangement
 * where a report saved in Jira is visible from the standalone app.
 *
 * See spec/026-storage-saved-reports/plan.md.
 */
const StorageView: FC = () => {
  const jira = useJira();
  const isConnect = jira.host === 'jira';
  /** Same stored shape on both hosts; only what each host's users would recognise differs. */
  const legacyLabel = isConnect ? CONNECT_OPTIONS[0].label : WEB_OPTIONS[0].label;

  const { showFlag } = useFlags();
  const config = useReportsStorageConfig();
  const { save, isSaving, error, reset } = useSaveReportsStorageConfig();
  const { migrate, progress, readLegacyReports, resetProgress } = useMigrateReports();

  const spaceNameId = useId();
  const spaceTypeId = useId();

  const [kind, setKind] = useState<StorageOptionValue>(config.kind);
  const [spaceName, setSpaceName] = useState(config.kind === 'space' ? config.spaceName : '');
  const [spaceType, setSpaceType] = useState(config.kind === 'space' ? config.spaceType : '');
  const [validation, setValidation] = useState<string | null>(null);
  const [pendingMigration, setPendingMigration] = useState<{ reportCount: number } | null>(null);

  // Every distinct key is its own query, so an undebounced field asks Jira once per keystroke.
  // `useDebounce` seeds itself with the initial value, so an already-configured space resolves its
  // types on mount with no delay.
  const debouncedSpaceName = useDebounce(spaceName, 300);
  const { issueTypes, isLoading: isLoadingIssueTypes, error: issueTypesError } = useSpaceIssueTypes(debouncedSpaceName);
  const issueTypeOptions: IssueTypeOption[] = issueTypes.map(({ name }) => ({ label: name, value: name }));

  /**
   * The chosen type, unless this space has since been shown not to offer it — editing the space key
   * after picking a type would otherwise leave the select visibly blank while the old value was
   * still what got saved. An empty list means "not answered yet" (loading, or unreadable), which is
   * not evidence against a type that is already configured.
   */
  const knownSpaceType = !issueTypes.length || issueTypes.some(({ name }) => name === spaceType) ? spaceType : '';

  const trimmedSpaceName = spaceName.trim();
  const isBusy = isSaving || progress.isMigrating;

  /**
   * Saving is otherwise silent — the panel already shows the state you just chose, so a successful
   * write changes nothing on screen. That is indistinguishable from a no-op failure, which is
   * exactly how a migration that legitimately copied nothing reads.
   */
  const commit = (migrationNote?: string) => {
    reset();
    setValidation(null);
    setPendingMigration(null);
    save(
      kind === 'space' ? { kind: 'space', spaceName: trimmedSpaceName, spaceType: knownSpaceType } : { kind: 'legacy' },
      {
        onSuccess: () => {
          const destination =
            kind === 'space'
              ? `Saved reports now load from ${trimmedSpaceName}.`
              : `Saved reports now load from ${legacyLabel}.`;

          showFlag({
            title: <Text color="color.text.success">Storage saved</Text>,
            description: [migrationNote, destination].filter(Boolean).join(' '),
            isAutoDismiss: true,
            icon: <SuccessIcon color={token('color.icon.success')} label="success" />,
          });
        },
      },
    );
  };

  const handleSave = async () => {
    reset();
    setValidation(null);

    if (kind === 'legacy') {
      commit();

      return;
    }

    if (!trimmedSpaceName) {
      setValidation('Enter the key of a space you have already created, e.g. STATREPS.');

      return;
    }

    if (!knownSpaceType) {
      setValidation(issueTypesError?.message ?? 'Choose the work item type each saved report should become.');

      return;
    }

    // Only offered when leaving the legacy record — that is the one direction where reports the user
    // can see today would otherwise not be in the store they are switching to.
    if (config.kind === 'legacy') {
      try {
        const legacyReports = await readLegacyReports();
        const reportCount = Object.keys(legacyReports).length;

        if (reportCount) {
          resetProgress();
          setPendingMigration({ reportCount });

          return;
        }
      } catch (readError) {
        // Nothing to migrate that we can see is not a reason to block the switch; the legacy record
        // is never deleted, so it is still there to migrate later.
        console.warn('[reports/storage] could not read the legacy saved reports before switching', readError);
      }
    }

    commit();
  };

  return (
    <div className="flex flex-col gap-y-4">
      <div className="pt-4">
        <Heading size="medium">Storage {isBusy && <Spinner size="small" />}</Heading>
      </div>

      <div className="flex flex-col gap-4">
        <StorageCard
          title="Connect"
          groupTitle="Reports storage"
          options={CONNECT_OPTIONS}
          selected={isConnect ? kind : null}
          disabled={!isConnect}
          note={isConnect ? undefined : 'Change these settings from the Status Reports app in Jira.'}
          onSelect={setKind}
        >
          <SpaceFields
            spaceNameId={spaceNameId}
            spaceTypeId={spaceTypeId}
            spaceName={spaceName}
            spaceType={knownSpaceType}
            options={issueTypeOptions}
            isLoadingIssueTypes={isLoadingIssueTypes}
            issueTypesError={issueTypesError}
            isDisabled={isBusy}
            onSpaceNameChange={setSpaceName}
            onSpaceTypeChange={setSpaceType}
          />
        </StorageCard>

        <StorageCard
          title="Web"
          groupTitle="Reports storage"
          options={WEB_OPTIONS}
          selected={isConnect ? null : kind}
          disabled={isConnect}
          note={isConnect ? 'Change these settings from the standalone web app.' : undefined}
          onSelect={setKind}
        >
          <SpaceFields
            spaceNameId={spaceNameId}
            spaceTypeId={spaceTypeId}
            spaceName={spaceName}
            spaceType={knownSpaceType}
            options={issueTypeOptions}
            isLoadingIssueTypes={isLoadingIssueTypes}
            issueTypesError={issueTypesError}
            isDisabled={isBusy}
            onSpaceNameChange={setSpaceName}
            onSpaceTypeChange={setSpaceType}
          />
        </StorageCard>
      </div>

      {/*
        Shown only when it is actually true — the saved setting is a space and you have just picked
        the other option. Reports created *while* pointed at a space live only there, so unlike the
        legacy record (which a switch to a space never touches) they do not come along. Nothing is
        deleted; it simply stops being listed, and switching back lists it again.
      */}
      {config.kind === 'space' && kind === 'legacy' && (
        <SectionMessage appearance="warning">
          <p className="text-sm">
            Reports saved into <span className="font-semibold">{config.spaceName}</span> stay there, but won&rsquo;t be
            listed while {legacyLabel} is selected. Switching back lists them again.
          </p>
        </SectionMessage>
      )}

      {(validation || error) && <ErrorMessage>{validation ?? error?.message}</ErrorMessage>}

      <div className="flex justify-end">
        <Button appearance="primary" onClick={handleSave} isDisabled={isBusy}>
          Save
        </Button>
      </div>

      <MigrateReportsModal
        isOpen={!!pendingMigration}
        spaceName={trimmedSpaceName}
        reportCount={pendingMigration?.reportCount ?? 0}
        progress={progress}
        onMigrate={async () => {
          const result = await migrate({ spaceName: trimmedSpaceName, spaceType: knownSpaceType });

          // A partial copy leaves the pointer alone: the app keeps reading the legacy record, which
          // still holds everything, and pressing Save again repairs the copy instead of duplicating.
          if (result.failures.length) {
            return;
          }

          commit(describeMigration(result, trimmedSpaceName));
        }}
        onStartEmpty={() => commit()}
        onClose={() => setPendingMigration(null)}
      />
    </div>
  );
};

export default StorageView;

const reportWord = (count: number) => (count === 1 ? 'report' : 'reports');

/**
 * What the migration actually did — including the case where it correctly did nothing.
 *
 * A re-run over a space that already holds every report copies zero, which is the right answer and
 * used to render as complete silence: the modal closed, the panel looked unchanged, and there was no
 * way to tell that from a failure. Saying "they were already there" is the whole point of this
 * string.
 */
const describeMigration = (
  { copied, alreadyThere }: { copied: number; alreadyThere: number },
  spaceName: string,
): string => {
  if (!copied) {
    // "All 1 saved report were already there" — the count adds nothing when there is one of them.
    return alreadyThere === 1
      ? `The saved report was already in ${spaceName}, so nothing was copied.`
      : `All ${alreadyThere} saved reports were already in ${spaceName}, so nothing was copied.`;
  }

  if (!alreadyThere) {
    return `Copied ${copied} saved ${reportWord(copied)} into ${spaceName}.`;
  }

  return `Copied ${copied} saved ${reportWord(copied)} into ${spaceName}; ${alreadyThere} ${alreadyThere === 1 ? 'was' : 'were'} already there.`;
};

interface SpaceFieldsProps {
  spaceNameId: string;
  spaceTypeId: string;
  spaceName: string;
  spaceType: string;
  options: IssueTypeOption[];
  isLoadingIssueTypes: boolean;
  /** Why this space's work item types could not be listed — which is also how a bad key surfaces. */
  issueTypesError: Error | null;
  isDisabled: boolean;
  onSpaceNameChange: (value: string) => void;
  onSpaceTypeChange: (value: string) => void;
}

/**
 * Space Name is the key of a space the user has **already created** — the app never creates one, so
 * this is a lookup, not a name to be invented.
 *
 * The type list is what validates the key as you type: it comes from that space's own create
 * metadata, so a key that doesn't exist (or that you cannot create in) fails to load and says so
 * here, rather than looking fine until Save.
 */
const SpaceFields: FC<SpaceFieldsProps> = ({
  spaceNameId,
  spaceTypeId,
  spaceName,
  spaceType,
  options,
  isLoadingIssueTypes,
  issueTypesError,
  isDisabled,
  onSpaceNameChange,
  onSpaceTypeChange,
}) => {
  const hasSpaceName = !!spaceName.trim();

  return (
    <div className="flex flex-col gap-3 pt-2 pl-6">
      <div className="flex flex-col gap-1">
        <Label htmlFor={spaceNameId}>Space Name</Label>
        <Textfield
          id={spaceNameId}
          value={spaceName}
          isDisabled={isDisabled}
          isInvalid={!!issueTypesError}
          placeholder="STATREPS"
          onChange={(event) => onSpaceNameChange((event.target as HTMLInputElement).value)}
        />
        {issueTypesError ? (
          <ErrorMessage>{issueTypesError.message}</ErrorMessage>
        ) : (
          <HelperMessage>The key of a space you have already created.</HelperMessage>
        )}
      </div>

      <div className="flex flex-col gap-1">
        <Label htmlFor={spaceTypeId}>Space Type {isLoadingIssueTypes && <Spinner size="small" />}</Label>
        <Select<IssueTypeOption>
          inputId={spaceTypeId}
          options={options}
          isDisabled={isDisabled || !options.length}
          placeholder={selectPlaceholder({ hasSpaceName, isLoadingIssueTypes, hasError: !!issueTypesError })}
          value={options.find((option) => option.value === spaceType) ?? null}
          onChange={(option) => onSpaceTypeChange(option?.value ?? '')}
        />
      </div>

      {/* Scoped to the space option rather than the panel: none of it is true of the legacy record,
          which needs no permissions beyond the ones the app already has. */}
      <p className="text-slate-300 text-xs">
        Reports are saved as work items in this space, so any app pointed at it shares them. Needs permission to create
        and edit work items there.
      </p>
    </div>
  );
};

const selectPlaceholder = ({
  hasSpaceName,
  isLoadingIssueTypes,
  hasError,
}: {
  hasSpaceName: boolean;
  isLoadingIssueTypes: boolean;
  hasError: boolean;
}): string => {
  if (!hasSpaceName) {
    return 'Enter a space name first';
  }

  if (isLoadingIssueTypes) {
    return 'Reading this space…';
  }

  if (hasError) {
    return 'No types to choose from';
  }

  return 'Choose a work item type';
};
