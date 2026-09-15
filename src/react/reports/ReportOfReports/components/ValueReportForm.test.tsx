import type { FC, ReactNode } from 'react';
import type { Jira } from '../../../../jira-oidc-helpers';

import React from 'react';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { JiraProvider } from '../../../services/jira';
import { ValueReportForm } from './ValueReportForm';

const catalog = [
  { id: 'summary', name: 'Summary' },
  { id: 'customfield_10014', name: 'Story points' },
];

/**
 * Flipped by the one test that reviews the Suspense fallback.
 *
 * `vi.mock` is hoisted and file-wide, so "skip the module mock for this test" is not available —
 * the mock throws a never-resolving promise instead, which is exactly what a suspended read does.
 * That exercises the boundary rather than React Query's plumbing, which is the same reason the
 * catalog is mocked here at all.
 */
let suspendCatalog = false;

// `useJiraIssueFields` is a suspense query; stub it so these tests exercise the form rather than
// React Query's suspense plumbing — the pattern `useInlineExpression.test.tsx` established.
vi.mock('../../../services/jira/useJiraIssueFields', () => ({
  useJiraIssueFields: () => {
    if (suspendCatalog) throw new Promise(() => {});

    return catalog;
  },
}));

/** Every query that actually reached Jira — the "don't ask on one character" assertion reads this. */
let queries: string[] = [];

const jira = {
  fetchIssuePickerSuggestions: async (query: string) => {
    queries.push(query);

    return { sections: [{ id: 'cs', issues: [{ key: 'ABC-1', summaryText: 'Migrate auth to OIDC' }] }] };
  },
} as unknown as Jira;

const renderForm = () => {
  const onAdd = vi.fn();
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });

  const Wrapper: FC<{ children: ReactNode }> = ({ children }) => (
    <QueryClientProvider client={queryClient}>
      <JiraProvider jira={jira}>{children}</JiraProvider>
    </QueryClientProvider>
  );

  render(
    <Wrapper>
      <ValueReportForm onAdd={onAdd} />
    </Wrapper>,
  );

  return { onAdd };
};

const addButton = () => screen.getByTestId('ror-value-add');

const pickWorkItem = async () => {
  // Typing is what opens react-select's menu; the suggestion list is fetched, so the option has to
  // arrive before it can be clicked. `fireEvent`, not `userEvent`: the menu portals to `document.body`
  // and repositions as it opens, which `userEvent.type`'s per-keystroke awaits can type across.
  fireEvent.change(screen.getByLabelText('Work item'), { target: { value: 'ABC' } });
  // 3s, not the 1s default — the typeahead debounces 300ms of real time before it asks, which leaves
  // too little of the default budget under full-suite load. See the same note in ReportOfReports.test.
  fireEvent.click(await screen.findByText('ABC-1 — Migrate auth to OIDC', undefined, { timeout: 3000 }));
};

// The *locator* has not changed across spec/033's swap from an `@atlaskit/select` to a
// `SearchablePicker`: `getByLabelText('Field')` still resolves, now to the trigger `<button>`, via
// `HTMLButtonElement.labels` (`@testing-library/dom/.../label-helpers.js:29-37`, whose
// `formControlSelector` includes `button`). Only the interaction did — a click, not ArrowDown.
//
// `within` the popover because the trigger now renders the picked label too, so an unscoped
// `getByText` would match two nodes after the first pick.
const pickField = (label: string) => {
  fireEvent.click(screen.getByLabelText('Field'));
  fireEvent.click(within(screen.getByTestId('ror-field-popover')).getByText(label));
};

// See spec/016-report-of-reports/009-value-report-modal Phase 4.
describe('<ValueReportForm>', () => {
  beforeEach(() => {
    queries = [];
    // The picker persists its expand/collapse choice; a leaked value would change what these render.
    localStorage.clear();
  });

  afterEach(() => localStorage.clear());

  it('keeps Add disabled until both halves are chosen', async () => {
    renderForm();

    expect(addButton()).toBeDisabled();

    await pickWorkItem();
    expect(addButton()).toBeDisabled();

    pickField('Summary');
    expect(addButton()).toBeEnabled();
  });

  // A bare `+` has to be guessed at, and its disabled state — the only validation this form has —
  // reads as decoration. See spec/016-report-of-reports/009-value-report-modal § Restructure.
  it('labels the add control and both inputs', () => {
    renderForm();

    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument();
    expect(screen.getByLabelText('Work item')).toBeInTheDocument();
    // Also proves the label association survived the swap to a `<button>` trigger: a native
    // `<label htmlFor>` reaches a button through `element.labels`. What does *not* work is
    // `getByRole('button', { name: 'Field' })` — a `<label>` contributes nothing to a button's
    // accessible name. See spec/033-column-select-redesign § 9.
    expect(screen.getByLabelText('Field')).toBeInTheDocument();
  });

  it('stays disabled when only a field is chosen', () => {
    renderForm();

    pickField('Summary');

    expect(addButton()).toBeDisabled();
  });

  it('emits the field id, not its display name', async () => {
    const { onAdd } = renderForm();

    await pickWorkItem();
    pickField('Story points');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('(issue = ABC-1).customfield_10014');
  });

  it('emits the latest-comment expression for the derived entry', async () => {
    const { onAdd } = renderForm();

    await pickWorkItem();
    pickField('Latest Comment');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('(issue = ABC-1).latestComment');
  });

  // The second derived entry, offered from the same dropdown and stored the same way — the accessor is
  // the whole of what makes the node a status-update one.
  // See spec/027-status-updates § The accessor and the dropdown.
  //
  // Temporarily withdrawn from the dropdown — see `DERIVED_OPTIONS`' comment in fieldCatalog.ts —
  // because its label collided with the real "Status Update" custom field now offered under `Fields`.
  it.skip('emits the status-update expression for the second derived entry', async () => {
    const { onAdd } = renderForm();

    await pickWorkItem();
    pickField('Status Update');
    fireEvent.click(addButton());

    expect(onAdd).toHaveBeenCalledWith('(issue = ABC-1).statusUpdate');
  });

  it('resets both halves after adding, so a second add cannot inherit the first', async () => {
    renderForm();

    await pickWorkItem();
    pickField('Summary');
    fireEvent.click(addButton());

    await waitFor(() => expect(addButton()).toBeDisabled());
    // Both halves are back to their placeholders — neither the picked field nor the picked work item
    // is still displayed anywhere. Since spec/033 this is a *stronger* assertion than it was: the
    // field trigger renders the picked label as its own text, where the old closed react-select
    // rendered it only inside a menu that was unmounted anyway.
    expect(screen.queryByText('Summary')).not.toBeInTheDocument();
    expect(screen.queryByText(/ABC-1/)).not.toBeInTheDocument();
  });

  // The picker used to ask on every query including the empty one, whose `hs` section is the caller's
  // recently-viewed list — which read as a mystery list, since it is neither everything nor what you
  // typed. See `useWorkItemSearch`'s MIN_QUERY_LENGTH.
  it('shows nothing until enough is typed to search on', async () => {
    renderForm();

    expect(queries).toEqual([]);

    fireEvent.change(screen.getByLabelText('Work item'), { target: { value: 'A' } });

    expect(await screen.findByText('Keep typing…')).toBeInTheDocument();
    expect(queries).toEqual([]);
  });

  // See spec/033-column-select-redesign § 10.
  describe('the field trigger', () => {
    it('shows the placeholder, then the field that was picked', () => {
      renderForm();

      expect(screen.getByLabelText('Field')).toHaveTextContent('Field');

      pickField('Story points');

      expect(screen.getByLabelText('Field')).toHaveTextContent('Story points');
    });

    it('closes its popover on select', () => {
      renderForm();

      fireEvent.click(screen.getByLabelText('Field'));
      expect(screen.getByTestId('ror-field-popover')).toBeInTheDocument();

      fireEvent.click(within(screen.getByTestId('ror-field-popover')).getByText('Summary'));

      expect(screen.queryByTestId('ror-field-popover')).not.toBeInTheDocument();
    });

    /**
     * The Suspense fallback, which nothing covered before spec/033 even though it is the entire
     * reason `FieldPicker` is split out of this form. What it must hold is the *label association*:
     * the fallback carries `id="ror-value-field"` too, so `<label htmlFor>` is never dangling
     * mid-suspense.
     *
     * The no-layout-shift half of the claim — that the fallback is a byte-identically sized 40px box
     * — is not checkable here; jsdom has no layout. That is `FieldCatalogLoading`'s job.
     */
    it('renders the same control, disabled, while the catalog is still arriving', () => {
      suspendCatalog = true;

      try {
        renderForm();

        const trigger = screen.getByLabelText('Field');

        expect(trigger).toHaveAttribute('id', 'ror-value-field');
        expect(trigger).toBeDisabled();
        expect(trigger).toHaveTextContent('Field');
      } finally {
        suspendCatalog = false;
      }
    });
  });
});
