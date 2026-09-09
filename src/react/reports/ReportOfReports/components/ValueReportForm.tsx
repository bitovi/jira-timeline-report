import type { FC, ReactNode } from 'react';
import type { StylesConfig } from '@atlaskit/select';

import React, { Suspense, useMemo, useState } from 'react';
import Select from '@atlaskit/select';
import Button from '@atlaskit/button/new';
import Spinner from '@atlaskit/spinner';
import ChevronDownIcon from '@atlaskit/icon/utility/migration/chevron-down';

import type { FieldGroup, FieldOption } from '../model/fieldCatalog';
import type { PickerTriggerProps } from '../../../components/SearchablePicker';

import { SearchablePicker } from '../../../components/SearchablePicker';
import { useJiraIssueFields } from '../../../services/jira/useJiraIssueFields';
import { useWorkItemSearch } from '../hooks/useWorkItemSearch';
import { buildFieldOptions, buildValueExpression, FIELD_GROUP_ORDER } from '../model/fieldCatalog';

/**
 * `Common` is curated in its useful order on purpose — `fieldCatalog.ts:57-68` promotes eight ids so
 * an unfiltered list leads with Summary / Status / Assignee. `Derived` has one entry, and `Fields`
 * arrives name-sorted from `useJiraIssueFields`, so sorting it only guarantees what is already true.
 */
const UNSORTED_FIELD_GROUPS: FieldGroup[] = ['Common'];

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
  // The `FieldOption` itself, not a `{ value, label }` round-trip: the trigger needs the label and
  // `buildValueExpression` needs the id, and both are already on the catalog entry.
  const [field, setField] = useState<FieldOption | null>(null);

  const { suggestions, isLoading, isTooShort } = useWorkItemSearch(inputValue);

  const options = useMemo<SelectOption[]>(
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
        {/* The fallback is the same control, disabled and loading, in a byte-identically sized 40px
            box — so nothing moves when the catalog arrives. That is the whole reason `FieldTrigger`
            is a component of its own rather than JSX inside `FieldPicker`. */}
        <Suspense fallback={<FieldTrigger label={null} isDisabled isLoading />}>
          <FieldPicker value={field} onChange={setField} />
        </Suspense>
      </Field>
      {/* A labelled button rather than a bare `+`. An unlabelled icon has to be guessed at, and its
          disabled state — which is the only validation this form has — reads as decoration rather than
          as "you are not done yet".

          `h-10` because an Atlaskit button is 32px and an Atlaskit select is 40px (`styles.js:79`), so
          the two don't line up on their own — bottom-aligning a shorter control just makes it look
          dropped. The child selector is how the height reaches the button: `Button` doesn't forward
          `className`, and Tailwind's `.foo > button` beats emotion's single-class rule on specificity
          whichever order they load in.

          `items-center` goes with the height, and has to: the button lays its label out with
          `align-items: baseline` (`use-button-base.js:32`), which centres the text only at the 32px
          height it ships with. Stretching the box to 40px leaves the baseline where it was, so the
          label sits high in the taller button until this overrides it.

          The 5px of padding under it lifts the button off the row's bottom edge: `items-end` aligns the
          two boxes exactly, but a select's visual weight sits above its border box, so matched edges
          still read as the button hanging low. Measured by eye, hence the odd value. */}
      <div className="[&>button]:h-10 [&>button]:items-center">
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
 * The Field control's button, styled to be indistinguishable from the `@atlaskit/select` it sits
 * beside in the same grid row.
 *
 * **Tailwind arbitrary values wrapping the select's own CSS variables** — not the Tailwind palette,
 * and not `token()`.
 *
 * *Not the Tailwind palette*, because it almost works, which is the trap: `neutral.100` = `#7A869A`
 * = N100 ✓, `neutral.200` = `#6B778C` = N200 ✓, `neutral.800` = `#172B4D` = N800 ✓, `blue.200` =
 * `#4C9AFF` = B100 ✓ — but `neutral.20` = `#F1F2F4` while the select's resting fill is N20 =
 * `#F4F5F7` ✗. Four of five match, so it looks right until you look at the fill. And a hardcoded hex
 * cannot follow `--ds-*`, so the pair would diverge under any non-default theme — and this app has
 * one (spec/016-report-of-reports/008-theme).
 *
 * *Not `token()`*, because it emits the same `var(--ds-…, fallback)` string but only through a
 * `style` prop or emotion, and mixing that into a Tailwind-classed component recreates exactly the
 * specificity fight the `Add` button's comment below already documents.
 *
 * Every value below is read from `@atlaskit/select/dist/cjs/styles.js` — a **private** file, not a
 * public entry point, so a minor bump can drift the pair silently and no test will catch it. The
 * only mitigation that works is keeping the `FieldTriggerStates` story (which puts a real select
 * beside this) and looking at it. See spec/031-column-select-redesign § 9 and Risk 1.
 *
 * `h-10`, not `min-h-10`: the select's `minHeight: 40` (`styles.js:79`) never actually grows,
 * because its value never wraps — so neither must this, or the pair can differ in height on a long
 * field name. Hence `truncate` too.
 *
 * **One deliberate divergence.** The select rings on `:focus-within` (`styles.js:76-78`), which
 * fires on a mouse click as well; this rings on `:focus-visible`. It cannot be otherwise: clicking
 * this trigger opens a popover that takes focus into its own search field, so the trigger is not
 * focused while its list is open — where clicking the select leaves focus in the select. That is
 * inherent to a popover-with-search versus an inline combobox input, not something a CSS variant
 * fixes. Converge the rest by eye in the story.
 */
const FIELD_TRIGGER_CLASS_NAME = [
  // layout — `styles.js:79` (minHeight 40), `:104-107` (valueContainer padding), `:20` (container font)
  'group flex h-10 w-full items-center justify-between',
  'px-[6px] py-[2px] text-sm font-normal leading-5',
  // box — `styles.js:72-74`
  'rounded-[var(--ds-border-radius-100,3px)] border-[length:var(--ds-border-width,1px)] border-solid',
  'border-[var(--ds-border-input,#7A869A)]',
  // fill and hover — `styles.js:36`, `:37`, `:93`
  'cursor-pointer bg-[var(--ds-background-input,#F4F5F7)]',
  'hover:bg-[var(--ds-background-input-hovered,#EBECF0)]',
  // focus — `styles.js:34`, `:36`, `:76-78` (`inset 0 0 0 1px <borderColor>`)
  'focus-visible:border-[var(--ds-border-focused,#4C9AFF)]',
  'focus-visible:bg-[var(--ds-background-input-pressed,#FFFFFF)]',
  'focus-visible:shadow-[inset_0_0_0_var(--ds-border-width,1px)_var(--ds-border-focused,#4C9AFF)]',
  'focus-visible:outline-none',
  // `styles.js:80`
  'transition-[background-color,border-color] duration-200 ease-in-out',
  // `styles.js:40-43`; the text colour is `singleValue`'s disabled branch (`:196`)
  'disabled:cursor-not-allowed disabled:border-[var(--ds-background-disabled,#F4F5F7)]',
  'disabled:bg-[var(--ds-background-disabled,#F4F5F7)] disabled:text-[var(--ds-text-disabled,#A5ADBA)]',
].join(' ');

export interface FieldTriggerProps {
  /** The picked field's name; `null` shows the placeholder. */
  label: string | null;
  isDisabled?: boolean;
  isLoading?: boolean;
  /**
   * From `SearchablePicker`'s `trigger` render prop. Absent for the Suspense fallback, which is the
   * whole reason this is a component rather than JSX inside `FieldPicker` — the fallback has to
   * render the same 40px box with no picker behind it.
   */
  triggerProps?: PickerTriggerProps;
  onClick?: () => void;
  /**
   * What `<label htmlFor>` points at. Defaults to the form's own id and should stay that way in the
   * form — the Suspense fallback carries it too, so the label is never dangling mid-suspense (no
   * duplicate-id risk: Suspense swaps the two, it does not render both). Overridable only so the
   * `FieldTriggerStates` story can show several of these at once without colliding ids.
   */
  id?: string;
}

export const FieldTrigger: FC<FieldTriggerProps> = ({
  label,
  isDisabled,
  isLoading,
  triggerProps,
  onClick,
  id = 'ror-value-field',
}) => (
  <button
    {...triggerProps}
    id={id}
    type="button"
    disabled={isDisabled}
    // `styles.js:196` (value) and `:189` (placeholder). On the button rather than the inner span so
    // the `disabled:` variant above can win, and so the caret can inherit through `group-disabled`.
    className={`${FIELD_TRIGGER_CLASS_NAME} ${
      label ? 'text-[var(--ds-text,#172B4D)]' : 'text-[var(--ds-text-subtlest,#6B778C)]'
    }`}
    onClick={onClick}
  >
    <span className="min-w-0 flex-1 truncate text-left">{label ?? 'Field'}</span>
    {/* `styles.js:133` (`dropdownIndicator`), whose `:126-131` padding is 2px each side. */}
    <span className="flex flex-none items-center px-[2px] text-[var(--ds-text-subtle,#42526E)] group-disabled:text-[var(--ds-text-disabled,#A5ADBA)]">
      {isLoading ? (
        <Spinner size="small" label="Loading fields" />
      ) : (
        // The same module the select imports (`select/.../indicators.js:12`, rendered at `:56-62`
        // with `color="currentColor"`), so the glyph and its size are identical by construction.
        <ChevronDownIcon label="" color="currentColor" />
      )}
    </span>
  </button>
);

/**
 * The field half, split out for one reason: `useJiraIssueFields` is a suspense query and ROR's only
 * boundary is at the top of the island (`ReportOfReportsWrapper.tsx:34`). A document holding no inline
 * values has never fetched the catalog — and that is exactly the document someone is looking at when
 * they add their first value — so without a nearer boundary, opening the modal would blank the whole
 * document to `Loading…` and rebuild it. Suspending this subtree instead means only the dropdown waits,
 * and the fallback is the same control disabled, so nothing moves when it arrives.
 *
 * **No regrouping.** `buildFieldOptions` already returns `{ id, label, group }[]`, which *is*
 * `PickerItem`, and `SearchablePicker` does its own grouping, ordering and empty-group dropping with
 * identical `groupOrder` semantics. The `useMemo` that used to rebuild react-select's
 * `{ label, options }` shape here was pure duplication.
 */
const FieldPicker: FC<{ value: FieldOption | null; onChange: (option: FieldOption | null) => void }> = ({
  value,
  onChange,
}) => {
  const fields = useJiraIssueFields();

  const options = useMemo(() => buildFieldOptions(fields), [fields]);

  return (
    <SearchablePicker
      items={options}
      groupOrder={FIELD_GROUP_ORDER}
      unsortedGroups={UNSORTED_FIELD_GROUPS}
      placeholder="Search fields…"
      emptyMessage="No fields match."
      testIdPrefix="ror-field"
      selectedId={value?.id ?? null}
      // Its own key, so expanding here does not also expand Table's `+ Add column`.
      layoutStorageKey="ror-field-picker-layout"
      // **The three props that make a popover with a search field work inside a modal.** See
      // spec/031-column-select-redesign § 8: `shouldRenderToParent` for both the stacking context
      // and `react-focus-lock`, and `fallbackPlacements` because `@atlaskit/popper` hardcodes
      // `flipVariations: false`, so a 640px panel anchored 300px into a 600px dialog would never try
      // right-aligning itself without this list.
      shouldRenderToParent
      fallbackPlacements={['bottom-end', 'top-start', 'top-end']}
      role="dialog"
      label="Choose a field"
      onSelect={(id) => onChange(options.find((option) => option.id === id) ?? null)}
      trigger={(triggerProps, toggle) => (
        <FieldTrigger label={value?.label ?? null} triggerProps={triggerProps} onClick={toggle} />
      )}
    />
  );
};

export default ValueReportForm;
