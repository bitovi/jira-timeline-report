import type { FC } from 'react';
import type { LayoutPath } from '../model/sections';

import React from 'react';
import AddIcon from '@atlaskit/icon/core/add';

import { useReportLayout } from '../../../services/report-layout';
import { appendNode, canAddSectionAt, inlineValueNode, sectionNode } from '../model/sections';
import { latestCommentExpression } from '../model/accessors';
import { useDocumentEditing } from './DocumentEditing';

export interface AddContentRowProps {
  /** The container these buttons add into — `[]` for the document root. */
  path: LayoutPath;
  /**
   * Names the container in each button's accessible label, for the same reason `NodeControls` takes
   * one: the document root's row and every section's row would otherwise all read "Add Report".
   * Omitted at the root, so its buttons keep the bare label.
   */
  label?: string;
  /** An empty container gets a resting line of copy where its buttons will appear. */
  isEmpty?: boolean;
}

/**
 * The `[+ Add Report] [+ Add Section]` row that closes the document and every section in it, plus
 * `[+ Add Work Item Update]` on sections only.
 *
 * One pattern everywhere: the same buttons, worded and styled the same, at every level. They're
 * deliberately quieter than the theme's primaries — a document with four sections would otherwise
 * have five call-to-action rows down the page, all shouting.
 *
 * The root's pair is always visible. A section's pair is invisible until the pointer is somewhere in
 * that section, and an empty section shows "Nothing here yet." in the same fixed-height slot the
 * buttons will occupy, so revealing them shifts nothing.
 *
 * An editing affordance rather than content, so the whole row carries `print-hidden`
 * (src/css/print.css). "Add Section" is hidden — not disabled — once nesting reaches
 * `MAX_SECTION_DEPTH`: there is no state to explain, the level simply doesn't take another section.
 * **"Add Work Item Update" is section-only, and has no depth cap.** It's absent from the document root's
 * row: a comment is a note *about* something, so it belongs beside the report or section it comments on
 * rather than floating at the top of the document. It carries no cap because the node it creates holds
 * nothing and so can't deepen the tree — the opposite of "Add Section".
 *
 * It appends an `inline-value` node seeded with `(issue = ).latestComment`, which is to say it's a
 * preset of the parked "Add Value" rather than a second concept — the reason it costs nothing in
 * `sections.ts`. Restoring "Add Value" is uncommenting one block.
 *
 * See spec/016-report-of-reports/002-nested-sections, .../003-self-reports Phase 4,
 * .../004-redesign §6, and .../007-latest-comment-report Phase 5.
 */
export const AddContentRow: FC<AddContentRowProps> = ({ path, label, isEmpty = false }) => {
  const { sections, setSections } = useReportLayout();
  const { beginEditing, openReportPicker, isContainerHovered, markAddTarget } = useDocumentEditing();

  const isRoot = path.length === 0;
  // The *innermost* container the pointer is in, not every container it's inside: pointing at
  // something three levels deep should offer to add there, not at all three levels at once.
  const isShowing = isRoot || isContainerHovered(path);

  // The visible text stays "Add Report" everywhere; only the accessible name is individuated, and it
  // still starts with the visible text (WCAG 2.5.3, Label in Name).
  const into = label ? ` to ${label}` : '';

  return (
    <div className="group relative min-h-10 print-hidden">
      {isEmpty && (
        // `pointer-events-none` is load-bearing, not a nicety: this shares the buttons' slot by being
        // positioned, and a positioned element paints over in-flow siblings whatever its opacity is.
        // Without it, the faded-out copy sits on top of the buttons it just revealed and eats every
        // click. Nothing in jsdom can catch that — no stylesheet is loaded and nothing hit-tests — so
        // the test below asserts the class itself.
        //
        // `group-focus-within` mirrors the buttons' own `focus-within` below. The two are siblings,
        // so this copy cannot see the buttons' focus directly — without the group it would stay
        // fully opaque while a keyboard user tabbed the buttons in underneath it, and the two would
        // render on top of each other.
        <div
          data-testid="empty-container-note"
          className={`pointer-events-none absolute inset-0 flex items-center px-2 transition-opacity duration-150 group-focus-within:opacity-0 ${
            isShowing ? 'opacity-0' : 'opacity-100'
          }`}
        >
          <span className="text-sm italic text-slate-500">Nothing here yet.</span>
        </div>
      )}
      {/* Marking the target is the row's job, not each button's: both buttons add into the same
          container, so moving between them must not clear and re-set it — the one-frame gap that
          would leave reads as a flicker. Enter is per button (the row spans the full width, and the
          empty space beside the buttons promises nothing); leaving the row clears. `onBlur` fires
          before the next `onFocus`, so it checks where focus went for the same reason. */}
      <div
        data-testid="add-content-row"
        data-visible={isShowing}
        onMouseLeave={() => markAddTarget(null)}
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            markAddTarget(null);
          }
        }}
        className={`flex min-h-10 items-center gap-1 transition-opacity duration-150 ${
          isShowing
            ? 'opacity-100'
            : 'opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto'
        }`}
      >
        <AddButton
          text="Add Report"
          name={label && `Add Report${into}`}
          onTarget={() => markAddTarget(path)}
          // The picker covers the document with the pointer still on this button, and whatever is
          // chosen pushes the row down before it uncovers — so no `mouseleave` is coming. Clearing
          // now beats a tint stranded behind the modal and left over after it closes.
          onClick={() => {
            markAddTarget(null);
            openReportPicker(path);
          }}
        />
        {canAddSectionAt(sections, path) && (
          <AddButton
            text="Add Section"
            name={label && `Add Section${into}`}
            onTarget={() => markAddTarget(path)}
            onClick={() => {
              // A new section arrives blank and open focused — otherwise the user has to hunt for
              // the empty thing they just created to name it.
              const node = sectionNode('');

              // The row is pushed down by what it just added, out from under the pointer, so the
              // tint would otherwise outlive the pointer being there.
              markAddTarget(null);
              setSections(appendNode(sections, node, path));
              beginEditing(node.id);
            }}
          />
        )}
        {/* "Add Value" is parked — again. Nothing beneath it is removed: the `inline-value` node, its
            parser, resolver, formatter, hook and view all stay live, reachable from a hand-edited or
            previously-saved document and covered by their own unit tests. "Add Work Item Update" below
            creates the same node type, so this is a commented-out *button*, not a dark feature.
            Third time round for this button — see .../004-redesign §6 and § Add Value, unparked.

        <AddButton
          text="Add Value"
          name={label && `Add Value${into}`}
          onTarget={() => markAddTarget(path)}
          onClick={() => {
            // Blank and open focused, for the reason a new section is: an expression is the whole of
            // what a value is, so one that arrives without its field open is an empty row the user
            // then has to find and click.
            const node = inlineValueNode('');

            markAddTarget(null);
            setSections(appendNode(sections, node, path));
            beginEditing(node.id);
          }}
        />
        */}
        {!isRoot && (
          <AddButton
            // "Add Work Item Update", not "Add Latest Comment": named for what the reader gets — the
            // current word on a work item — rather than for the Jira object it comes from. "Work item",
            // not "issue", so it matches the copy the node's own states use ("No work item matched.",
            // "Enter a work item key") and the term the rest of the app uses for Jira's renamed issue.
            text="Add Work Item Update"
            name={label && `Add Work Item Update${into}`}
            onTarget={() => markAddTarget(path)}
            onClick={() => {
              // The same node type "Add Value" creates, seeded with an expression instead of left blank —
              // which is the whole of what this button is. The seed decides how the node renders and how
              // it's edited: the accessor routes it to `LatestCommentView`, and the `issue = ` JQL is what
              // gets it a work item key field rather than an expression field.
              // See spec/016-report-of-reports/007-latest-comment-report Phase 5.
              const node = inlineValueNode(latestCommentExpression(''));

              markAddTarget(null);
              setSections(appendNode(sections, node, path));
              beginEditing(node.id);
            }}
          />
        )}
      </div>
    </div>
  );
};

/**
 * A borderless text button: muted at rest, neutral fill and an accent label under the pointer.
 *
 * `onTarget` fires on pointer *and* focus, so the container it adds into lights up for the keyboard
 * too — the buttons already reveal themselves on `focus-within`, and a tab that reveals a pair of
 * buttons without saying whose they are is the same puzzle this solves for the pointer.
 */
const AddButton: FC<{ text: string; name?: string; onClick: () => void; onTarget: () => void }> = ({
  text,
  name,
  onClick,
  onTarget,
}) => (
  <button
    type="button"
    aria-label={name}
    onClick={onClick}
    onMouseEnter={onTarget}
    onFocus={onTarget}
    className="inline-flex items-center gap-1 rounded px-2 py-1 text-sm text-neutral-801 transition-colors duration-150 hover:bg-neutral-201 hover:text-blue-300"
  >
    <AddIcon label="" />
    {text}
  </button>
);

export default AddContentRow;
