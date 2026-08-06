import type { FC } from 'react';
import type { FieldOption } from '../model/fieldCatalog';

import React, { Suspense, useMemo, useState } from 'react';
import Select from '@atlaskit/select';
import { IconButton } from '@atlaskit/button/new';
import AddIcon from '@atlaskit/icon/glyph/add';
import VisuallyHidden from '@atlaskit/visually-hidden';

import { SearchablePicker } from '../../../components/SearchablePicker';
import { useJiraIssueFields } from '../../../services/jira/useJiraIssueFields';
import { useWorkItemSearch } from '../hooks/useWorkItemSearch';
import { buildFieldOptions, buildValueExpression, FIELD_GROUP_ORDER } from '../model/fieldCatalog';

export interface ValueReportFormProps {
  /** Receives the built expression; the caller turns it into a node. */
  onAdd: (expression: string) => void;
}

interface WorkItemOption {
  label: string;
  value: string;
}

/** The trigger's resting label — also what the suspense fallback shows, so the row doesn't jump. */
const FIELD_PLACEHOLDER = 'Field';

const triggerClassName =
  'inline-flex h-10 w-full items-center justify-between gap-2 rounded border border-neutral-301 bg-neutral-100 px-2 text-sm hover:bg-neutral-201 cursor-pointer disabled:cursor-default';

/**
 * Pick a work item and a field, press `+`, get a value node.
 *
 * The impure half of the Add Report modal: it owns two fetches (the suggestion list and the field
 * catalog) where the saved-report half is entirely prop-driven, which is why it is its own component
 * rather than more JSX in `AddReportModal`.
 *
 * **`+` staying disabled until both halves are chosen is the only validation there is**, because a node
 * cannot be corrected once added — the trade the plan's § The node stops being editable accepts. It has
 * to actually hold.
 *
 * See spec/016-report-of-reports/009-value-report-modal Phase 4.
 */
export const ValueReportForm: FC<ValueReportFormProps> = ({ onAdd }) => {
  const [inputValue, setInputValue] = useState('');
  const [workItem, setWorkItem] = useState<WorkItemOption | null>(null);
  const [field, setField] = useState<FieldOption | null>(null);

  const { suggestions, isLoading } = useWorkItemSearch(inputValue);

  const options = useMemo<WorkItemOption[]>(
    () => suggestions.map(({ key, summary }) => ({ value: key, label: summary ? `${key} — ${summary}` : key })),
    [suggestions],
  );

  const canAdd = workItem !== null && field !== null;

  const handleAdd = () => {
    if (!workItem || !field) return;

    onAdd(buildValueExpression(workItem.value, field.id));
    setWorkItem(null);
    setField(null);
    setInputValue('');
  };

  return (
    <div className="grid grid-cols-[1fr_180px_32px] items-center gap-2 pb-2">
      <div>
        <VisuallyHidden>
          <label htmlFor="ror-value-work-item">Work item</label>
        </VisuallyHidden>
        <Select<WorkItemOption>
          inputId="ror-value-work-item"
          placeholder="Search work items…"
          options={options}
          value={workItem}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onChange={setWorkItem}
          isLoading={isLoading}
          // `null` disables filtering; a predicate here would *exclude* options, not pass them through.
          // The server already matched, and re-filtering client-side would hide results whose match was
          // on a summary word the typed text doesn't literally contain.
          filterOption={null}
          noOptionsMessage={() => (isLoading ? 'Searching…' : 'No work items found.')}
        />
      </div>
      <Suspense
        fallback={
          <button type="button" className={triggerClassName} disabled>
            <span className="text-slate-500">{FIELD_PLACEHOLDER}</span>
          </button>
        }
      >
        <FieldPicker value={field} onChange={setField} />
      </Suspense>
      <IconButton
        icon={AddIcon}
        label="Add value report"
        testId="ror-value-add"
        isDisabled={!canAdd}
        onClick={handleAdd}
      />
    </div>
  );
};

/**
 * The field half, split out for one reason: `useJiraIssueFields` is a suspense query and ROR's only
 * boundary is at the top of the island (`ReportOfReportsWrapper.tsx:34`). A document holding no inline
 * values has never fetched the catalog — and that is exactly the document someone is looking at when
 * they add their first value — so without a nearer boundary, opening the modal would blank the whole
 * document to `Loading…` and rebuild it. Suspending this subtree instead means only the dropdown waits.
 */
const FieldPicker: FC<{ value: FieldOption | null; onChange: (option: FieldOption) => void }> = ({
  value,
  onChange,
}) => {
  const fields = useJiraIssueFields();
  const options = useMemo(() => buildFieldOptions(fields), [fields]);

  return (
    <SearchablePicker
      items={options}
      groupOrder={FIELD_GROUP_ORDER}
      placeholder="Search fields…"
      emptyMessage="No fields match."
      testIdPrefix="ror-field"
      onSelect={(id) => {
        const picked = options.find((option) => option.id === id);

        if (picked) onChange(picked);
      }}
      trigger={(triggerProps, toggle) => (
        <button {...triggerProps} type="button" className={triggerClassName} onClick={toggle}>
          <span className={`truncate ${value ? '' : 'text-slate-500'}`}>{value?.label ?? FIELD_PLACEHOLDER}</span>
          <span aria-hidden className="shrink-0 text-slate-500">
            ▾
          </span>
        </button>
      )}
    />
  );
};

export default ValueReportForm;
