import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Button from '@atlaskit/button/new';
import Modal, { ModalFooter, ModalHeader, ModalTitle, ModalTransition } from '@atlaskit/modal-dialog';
import Select from '@atlaskit/select';

import type { Jira } from '../../../../jira-oidc-helpers';
import type { JiraIssuePickerResponse } from '../../../../jira-oidc-helpers/jira';
import { JiraProvider } from '../../../services/jira/JiraProvider';
import { jiraKeys } from '../../../services/jira/key-factory';
import { FieldTrigger, ValueReportForm } from './ValueReportForm';

// ---------------------------------------------------------------------------------------------------
// Both of this component's fetches, faked — Storybook has no credentials and can't `vi.mock`.
//
// The field catalog is a `useSuspenseQuery`, so it is PRE-SEEDED into the cache under its exact key
// with `staleTime: Infinity`; the query function never runs. The suggestion list is an ordinary
// `useQuery`, so it just goes through a stub `fetchIssuePickerSuggestions` — which is also where the
// loading and empty states come from, by making that stub slow or barren.
// The pattern is `TableReport.stories.tsx`'s.
// ---------------------------------------------------------------------------------------------------

const mockFields = [
  { name: 'Summary', key: 'summary', schema: { type: 'string' }, id: 'summary', custom: false },
  { name: 'Status', key: 'status', schema: { type: 'string' }, id: 'status', custom: false },
  { name: 'Assignee', key: 'assignee', schema: { type: 'user' }, id: 'assignee', custom: false },
  { name: 'Story points', key: 'customfield_10014', schema: { type: 'number' }, id: 'customfield_10014', custom: true },
  { name: 'Epic Link', key: 'customfield_10008', schema: { type: 'string' }, id: 'customfield_10008', custom: true },
];

const suggestions: JiraIssuePickerResponse = {
  sections: [
    {
      id: 'cs',
      label: 'Current Search',
      issues: [
        { key: 'ABC-1', summaryText: 'Migrate auth to OIDC' },
        { key: 'ABC-14', summaryText: 'Retire the legacy token exchange' },
      ],
    },
    { id: 'hs', label: 'History Search', issues: [{ key: 'OPS-92', summaryText: 'Rotate the signing key' }] },
  ],
};

const makeJira = (
  respond: () => Promise<JiraIssuePickerResponse>,
  fetchJiraFields: () => Promise<typeof mockFields> = async () => mockFields,
): Jira => ({ fetchJiraFields, fetchIssuePickerSuggestions: respond }) as unknown as Jira;

/**
 * `seedCatalog: false` leaves the `useSuspenseQuery` to actually run, which is what makes the
 * Suspense fallback reviewable — see `FieldCatalogLoading`.
 */
const withJira =
  (jira: Jira, { seedCatalog = true }: { seedCatalog?: boolean } = {}) =>
  (Story: React.FC) => {
    const client = new QueryClient({ defaultOptions: { queries: { staleTime: Infinity, retry: false } } });

    if (seedCatalog) {
      // Both modes: the catalog hook keys on login state, which Storybook doesn't control.
      client.setQueryData(jiraKeys.issueFields('auth'), mockFields);
      client.setQueryData(jiraKeys.issueFields('sample'), mockFields);
    }

    return (
      <QueryClientProvider client={client}>
        <JiraProvider jira={jira}>
          <Story />
        </JiraProvider>
      </QueryClientProvider>
    );
  };

const meta: Meta<typeof ValueReportForm> = {
  title: 'Reports/ReportOfReports/ValueReportForm',
  component: ValueReportForm,
  decorators: [
    (Story) => (
      <div className="w-[40rem] p-4">
        <Story />
      </div>
    ),
  ],
  args: { onAdd: () => {} },
};
export default meta;

type Story = StoryObj<typeof ValueReportForm>;

/**
 * At rest, before anything is typed — `+` is disabled and both selects show their placeholders. The
 * work-item list stays empty until two characters are typed, so there is nothing to show here yet.
 */
export const Resting: Story = {
  decorators: [withJira(makeJira(async () => suggestions))],
};

/** A suggestion lookup that never lands, so the select holds its spinner. Type two characters. */
export const Loading: Story = {
  decorators: [withJira(makeJira(() => new Promise(() => {})))],
};

export const NoResults: Story = {
  decorators: [withJira(makeJira(async () => ({ sections: [] })))],
};

/**
 * **Everything this form opens has to paint above a modal, and a real one.** The three overlays —
 * the work-item menu, the field menu, and the field picker's popover — each lose a different fight
 * inside `@atlaskit/modal-dialog`: a stacking layer at `z-index: 510`, a `react-focus-lock` that
 * pulls focus back out of anything portalled, and (historically) a clipping scroll container.
 *
 * This story used to be a plain `<div>` with `shadow-lg`, which has none of those: no stacking
 * layer, no focus lock, no `@atlaskit/layering`. It therefore showed a perfectly working popover
 * while the real modal was broken — worse than having no story, because it looked like a check.
 * It is a real `<Modal>` now. See spec/031-column-select-redesign § 8.
 *
 * Review at 1440 / 1280 / 1024: the expanded picker panel is 640px against a 600px dialog, so this
 * is also where `fallbackPlacements` earns its keep. What to look for is in § 13.
 */
export const InAModal: Story = {
  decorators: [
    withJira(makeJira(async () => suggestions)),
    (Story) => (
      <ModalTransition>
        <Modal onClose={() => {}}>
          <ModalHeader>
            <ModalTitle>Add Report</ModalTitle>
          </ModalHeader>
          {/* Not `ModalBody` — that is itself a scroll container, and `AddReportModal` deliberately
              does not use one either (see its docblock). Padding matched to the real dialog's band. */}
          <div className="border-y border-neutral-301 px-6 py-4">
            <Story />
          </div>
          <ModalFooter>
            <Button appearance="subtle">Cancel</Button>
          </ModalFooter>
        </Modal>
      </ModalTransition>
    ),
  ],
};

/** A failed lookup must leave the form usable — the field half and `+` still work. */
export const SuggestionsFailed: Story = {
  decorators: [
    withJira(
      makeJira(async () => {
        throw new Error('Jira said no');
      }),
    ),
  ],
};

/** Wired the way the modal wires it, so the enabled `+` and the reset-after-add are both reviewable. */
export const Interactive: Story = {
  decorators: [withJira(makeJira(async () => suggestions))],
  render: () => {
    const [added, setAdded] = useState<string[]>([]);

    return (
      <div className="flex flex-col gap-3">
        <ValueReportForm onAdd={(expression) => setAdded((all) => [...all, expression])} />
        <ul className="flex flex-col gap-1 text-sm">
          {added.map((expression, at) => (
            <li key={at} className="font-mono text-slate-600">
              {expression}
            </li>
          ))}
        </ul>
      </div>
    );
  },
};

// ---------------------------------------------------------------------------------------------------
// The Field trigger, beside a real select. See spec/031-column-select-redesign § 9 and Risk 1.
// ---------------------------------------------------------------------------------------------------

/** `ValueReportForm`'s own row, so the two controls are measured against each other, not in isolation. */
const TriggerRow: React.FC<{ note: string; children: React.ReactNode }> = ({ note, children }) => (
  <div>
    <p className="pb-1 text-xs text-slate-400">{note}</p>
    <div className="grid grid-cols-[1.3fr_1fr_auto] items-end gap-2">
      <div className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-neutral-801">Work item</span>
        <Select placeholder="Search work items…" options={[]} />
      </div>
      <div className="min-w-0">
        <span className="mb-1 block text-xs font-medium text-neutral-801">Field</span>
        {children}
      </div>
      <div className="[&>button]:h-10 [&>button]:items-center">
        <Button appearance="primary" isDisabled>
          Add
        </Button>
      </div>
    </div>
  </div>
);

/**
 * **Where § 9's pixel values converge, and the only thing that keeps them converged.**
 *
 * `FieldTrigger` matches an emotion-styled react-select by copying values out of
 * `@atlaskit/select/dist/cjs/styles.js` — a private file. A minor version bump can drift the pair
 * and no test will catch it, so the mitigation is this story with a **real** select in it, and
 * someone looking at it. That is a recurring cost, not a one-time one (Risk 1).
 *
 * Check, at 1440 / 1280 / 1024: the two boxes are the same height and the same 3px radius; the
 * resting fill is the same grey (`#F4F5F7`, *not* Tailwind's `neutral-20` `#F1F2F4`); the carets are
 * the same glyph at the same size and colour; hover darkens both the same way; the placeholder grey
 * matches; and a long value truncates rather than growing the box.
 *
 * Hover and focus are real states, so hover each pair and Tab through them rather than reading a
 * screenshot. Note the one deliberate divergence documented on `FieldTrigger`: the select rings on a
 * click, this rings only on `:focus-visible`.
 */
export const FieldTriggerStates: Story = {
  decorators: [withJira(makeJira(async () => suggestions))],
  render: () => (
    <div className="flex flex-col gap-5">
      <TriggerRow note="Resting, no value — the placeholder grey.">
        <FieldTrigger id="trigger-resting" label={null} />
      </TriggerRow>
      <TriggerRow note="With a value — the value grey, and the caret unchanged.">
        <FieldTrigger id="trigger-value" label="Story points" />
      </TriggerRow>
      <TriggerRow note="Disabled and loading — the Suspense fallback, in a byte-identically sized 40px box.">
        <FieldTrigger id="trigger-loading" label={null} isDisabled isLoading />
      </TriggerRow>
      <TriggerRow note="Disabled with a value.">
        <FieldTrigger id="trigger-disabled" label="Story points" isDisabled />
      </TriggerRow>
      <TriggerRow note="A custom-field name far longer than the column — must truncate, never grow.">
        <FieldTrigger id="trigger-long" label="Original story point estimate for the delivery workstream" />
      </TriggerRow>
    </div>
  ),
};

/**
 * **The Suspense fallback, beside the real work-item select.** The catalog seeds are dropped so the
 * suspense query actually runs, and `fetchJiraFields` never resolves, so the fallback holds.
 *
 * What to check is the claim jsdom cannot check: **nothing moves when the catalog arrives.** The
 * fallback is `FieldTrigger` disabled and loading, in the same 40px box with the same border and the
 * same grid column, so the row must not shift, resize or reflow at the moment it swaps. Compare its
 * disabled greys against the work-item select's by disabling that one too if needed.
 */
export const FieldCatalogLoading: Story = {
  decorators: [
    withJira(
      makeJira(
        async () => suggestions,
        // Never lands, so the boundary never resolves.
        () => new Promise(() => {}),
      ),
      { seedCatalog: false },
    ),
  ],
};
