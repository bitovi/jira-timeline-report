import type { FC, ReactNode } from 'react';
import type { StylesConfig } from '@atlaskit/select';

import React, { Suspense, useMemo, useState } from 'react';
import Select from '@atlaskit/select';
import Button from '@atlaskit/button/new';

import { useJiraIssueFields } from '../../../services/jira/useJiraIssueFields';
import { useWorkItemSearch } from '../hooks/useWorkItemSearch';
import { buildFieldOptions, buildValueExpression, FIELD_GROUP_ORDER } from '../model/fieldCatalog';

export interface ValueReportFormProps {
  /** Receives the built expression; the caller turns it into a node. */
  onAdd: (expression: string) => void;
}

interface SelectOption {
  label: string;
  value: string;
}

/**
 * Both menus render into `document.body` above the modal's own layer.
 *
 * A menu that renders inline is clipped by the modal body's scroll container; one that portals without
 * a `zIndex` paints *behind* the modal, because `@atlaskit/modal-dialog` establishes a stacking layer
 * of its own and react-select's portal defaults to `z-index: 1`. Both were live defects here — see
 * spec/016-report-of-reports/009-value-report-modal.
 */
const menuAboveModal: StylesConfig<SelectOption, false> = {
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

/**
 * Strips the caret off the work-item input, which is a search box wearing a select's clothes.
 *
 * A caret advertises a list you can open. This one has nothing to open until Jira answers a query, so
 * clicking it does visibly nothing — the affordance promises something the control cannot do. The
 * indicator separator goes too: it exists only to divide the caret from the value.
 *
 * The **field** select keeps both. It genuinely is a dropdown over a fixed list.
 */
const SEARCH_ONLY = { DropdownIndicator: null, IndicatorSeparator: null };

/**
 * Pick a work item and a field, press `+`, get a value node.
 *
 * The impure half of the Add Report modal: it owns two fetches (the suggestion list and the field
 * catalog) where the saved-report half is entirely prop-driven, which is why it is its own component
 * rather than more JSX in `AddReportModal`.
 *
 * **Two `@atlaskit/select`s rather than one select and one popover.** The field half was first built on
 * `SearchablePicker`, the control lifted out of Table's `+ Add column` — same searchable, grouped list,
 * one component for both. Inside a modal it was the wrong choice twice over: a Tailwind-styled trigger
 * sitting next to an Atlaskit select does not read as its sibling, and `@atlaskit/popup` renders under
 * the modal. Two selects are consistent by construction and layer correctly.
 *
 * **`+` staying disabled until both halves are chosen is the only validation there is**, because a node
 * cannot be corrected once added — the trade the plan's § The node stops being editable accepts. It has
 * to actually hold.
 *
 * See spec/016-report-of-reports/009-value-report-modal Phase 4.
 */
export const ValueReportForm: FC<ValueReportFormProps> = ({ onAdd }) => {
  const [inputValue, setInputValue] = useState('');
  const [workItem, setWorkItem] = useState<SelectOption | null>(null);
  const [field, setField] = useState<SelectOption | null>(null);

  const { suggestions, isLoading, isTooShort } = useWorkItemSearch(inputValue);

  const options = useMemo<SelectOption[]>(
    () => suggestions.map(({ key, summary }) => ({ value: key, label: summary ? `${key} — ${summary}` : key })),
    [suggestions],
  );

  const canAdd = workItem !== null && field !== null;

  const handleAdd = () => {
    if (!workItem || !field) return;

    onAdd(buildValueExpression(workItem.value, field.value));
    setWorkItem(null);
    setField(null);
    setInputValue('');
  };

  return (
    // Three children, one per column — each `Field` is its own label-plus-input, so a label can never
    // drift away from what it names. 1.3fr / 1fr because a work item reads as `ABC-123 — some summary`
    // while a field name is a word or two, so an even split truncates the half carrying the detail.
    // `items-end` bottom-aligns the button with the inputs rather than centring it against the labels.
    <div className="grid grid-cols-[1.3fr_1fr_auto] items-end gap-2">
      <Field htmlFor="ror-value-work-item" label="Work item">
        <Select<SelectOption>
          inputId="ror-value-work-item"
          placeholder="Search work items…"
          options={options}
          value={workItem}
          inputValue={inputValue}
          onInputChange={setInputValue}
          onChange={setWorkItem}
          isLoading={isLoading}
          menuPortalTarget={document.body}
          styles={menuAboveModal}
          // **No caret.** This is a search box, not a dropdown: it has no options until Jira answers a
          // query, so a caret invites a click that opens an empty menu and looks broken. The separator
          // goes with it — it exists to divide the caret from the value.
          components={SEARCH_ONLY}
          // `null` disables filtering; a predicate here would *exclude* options, not pass them through.
          // Jira already matched, and re-filtering client-side would hide results whose match was on a
          // summary word the typed text doesn't literally contain.
          filterOption={null}
          noOptionsMessage={() =>
            isLoading ? 'Searching…' : isTooShort ? 'Keep typing…' : inputValue ? 'No work items found.' : null
          }
        />
      </Field>
      <Field htmlFor="ror-value-field" label="Field">
        <Suspense
          fallback={<Select<SelectOption> inputId="ror-value-field" placeholder="Field" isDisabled isLoading />}
        >
          <FieldSelect value={field} onChange={setField} />
        </Suspense>
      </Field>
      {/* A labelled button rather than a bare `+`. An unlabelled icon has to be guessed at, and its
          disabled state — which is the only validation this form has — reads as decoration rather than
          as "you are not done yet".

          `h-10` because an Atlaskit button is 32px and an Atlaskit select is 40px (`styles.js:79`), so
          the two don't line up on their own — bottom-aligning a shorter control just makes it look
          dropped. The child selector is how the height reaches the button: `Button` doesn't forward
          `className`, and Tailwind's `.foo > button` beats emotion's single-class rule on specificity
          whichever order they load in. */}
      <div className="[&>button]:h-10">
        <Button appearance="primary" testId="ror-value-add" isDisabled={!canAdd} onClick={handleAdd}>
          Add
        </Button>
      </div>
    </div>
  );
};

/**
 * A labelled control, as **one** grid child.
 *
 * The label was briefly a grid child of its own, which put it in the row above its input with the
 * grid's row gap between them — so it read as floating above the row rather than as belonging to one
 * control. A column is one cell containing both; the grid only ever sees three children.
 *
 * `htmlFor` targets the select's `inputId`, which is what makes the label clickable and what the tests
 * find these by.
 */
const Field: FC<{ htmlFor: string; label: string; children: ReactNode }> = ({ htmlFor, label, children }) => (
  <div className="min-w-0">
    <label htmlFor={htmlFor} className="mb-1 block text-xs font-medium text-neutral-801">
      {label}
    </label>
    {children}
  </div>
);

/**
 * The field half, split out for one reason: `useJiraIssueFields` is a suspense query and ROR's only
 * boundary is at the top of the island (`ReportOfReportsWrapper.tsx:34`). A document holding no inline
 * values has never fetched the catalog — and that is exactly the document someone is looking at when
 * they add their first value — so without a nearer boundary, opening the modal would blank the whole
 * document to `Loading…` and rebuild it. Suspending this subtree instead means only the dropdown waits,
 * and the fallback is the same control disabled, so nothing moves when it arrives.
 */
const FieldSelect: FC<{ value: SelectOption | null; onChange: (option: SelectOption | null) => void }> = ({
  value,
  onChange,
}) => {
  const fields = useJiraIssueFields();

  const groups = useMemo(() => {
    const options = buildFieldOptions(fields);

    return FIELD_GROUP_ORDER.map((group) => ({
      label: group,
      options: options.filter((option) => option.group === group).map(({ id, label }) => ({ value: id, label })),
    })).filter((group) => group.options.length > 0);
  }, [fields]);

  return (
    <Select<SelectOption>
      inputId="ror-value-field"
      placeholder="Field"
      options={groups}
      value={value}
      onChange={onChange}
      menuPortalTarget={document.body}
      styles={menuAboveModal}
    />
  );
};

export default ValueReportForm;
