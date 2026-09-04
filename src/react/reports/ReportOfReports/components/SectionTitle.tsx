import type { FC } from 'react';

import React from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';
import EditIcon from '@atlaskit/icon/core/edit';

import { levelFontSizeClassName } from './NodeRow';
import { RowButton } from './RowButton';

/** Shown, and used as the accessible name, when a section has no title yet. */
export const UNTITLED_SECTION = 'Untitled section';

export interface SectionTitleProps {
  title: string;
  /** Nesting level, 1-based — scales the heading so the document has some outline. */
  depth: number;
  isEditing: boolean;
  onEdit: () => void;
  onConfirm: (title: string) => void;
  onCancel: () => void;
  /**
   * Whether the row this title belongs to is hovered — reveals the pencil that starts editing.
   * Irrelevant once `isEditing` is true.
   */
  isRowHovered?: boolean;
}

/**
 * A section's editable heading. Pure and prop-driven — the editing flag and every callback come from
 * the caller, so it can be storied and unit-tested without a document around it.
 *
 * Unlike `SaveReports`' `EditableTitle`, which writes the report *name* straight to Jira on confirm,
 * this **must not save**: a section title is document content, so it flows through the same
 * dirty → "Save report" path as every other layout edit. See
 * spec/016-report-of-reports/002-nested-sections.
 *
 * **Editing starts from a pencil, not from clicking the title.** The row now toggles its own collapse
 * on click (`useNodeRow`), and the title sits inside that row — if the bare title text also opened
 * editing, as `@atlaskit/inline-edit`'s read view always does with no prop to suppress it, the two
 * would fight over what a click on the title means. So the resting state renders its own plain heading
 * plus a pencil button, hover-revealed the way `NodeControls` reveals — and `InlineEdit` only ever
 * mounts once editing has actually begun, with `isEditing` hardcoded `true`: its read view (and the
 * click trigger that comes bundled with it) is never rendered at all. The pencil keeps the exact
 * accessible name that read-view trigger used to carry (`"{title}, edit"`), so nothing that found this
 * control by name has to change.
 */
export const SectionTitle: FC<SectionTitleProps> = ({
  title,
  depth,
  isEditing,
  onEdit,
  onConfirm,
  onCancel,
  isRowHovered,
}) => {
  const { Heading, className } = headingFor(depth, isRowHovered);
  const label = title || UNTITLED_SECTION;

  if (!isEditing) {
    return (
      <div className="flex min-w-0 items-center gap-1">
        {/* The untitled placeholder is muted with opacity rather than a separate fixed color, so it
            stays legibly dimmer than every depth's own color without a fourth color to maintain. */}
        <Heading className={`${className} min-w-0 truncate ${title ? '' : 'italic font-normal opacity-60'}`}>
          {label}
        </Heading>
        {/* `report-chrome-hidden` (print.css/fullscreen.css) matches every other editing affordance on
            the row — renaming a report that's being presented is not on offer there either. */}
        <div
          className={`report-chrome-hidden transition-opacity duration-150 ${
            isRowHovered
              ? 'opacity-100'
              : 'opacity-0 pointer-events-none focus-within:opacity-100 focus-within:pointer-events-auto'
          }`}
        >
          <RowButton
            icon={EditIcon}
            label={`${label}, edit`}
            // Stops the click from also bubbling to the row and toggling its collapse.
            onClick={(event) => {
              event.stopPropagation();
              onEdit();
            }}
          />
        </div>
      </div>
    );
  }

  return (
    // InlineEdit's internal styles can't be reached through props; this drops its outer margin.
    // `grow` lets the field take the row's own width while it's open. `stopPropagation` keeps a click
    // anywhere in the field (or its Confirm/Cancel buttons) from also toggling the row's collapse.
    <div className="[&>form>div]:!m-0 min-w-0 grow" onClick={(event) => event.stopPropagation()}>
      <InlineEdit
        isEditing
        onEdit={onEdit}
        defaultValue={title}
        onConfirm={onConfirm}
        onCancel={onCancel}
        editButtonLabel={label}
        editView={({ errorMessage, ...fieldProps }) => (
          // `autoFocus` is what makes a freshly added section land with its title ready to type.
          <Textfield {...fieldProps} autoFocus autoComplete="new-password" placeholder="Section title" />
        )}
        // Never actually rendered — `isEditing` above is hardcoded `true`, so `InlineEdit` never shows
        // its read view. A no-op function that satisfies the (required) prop.
        readView={() => null}
      />
    </div>
  );
};

/**
 * Scales the heading with nesting via the shared `levelFontSizeClassName` scale — the same one a report
 * row's title uses at the same depth, since indent and size are a function of level only, not of
 * whether the node is a section or a report. See spec/029-report-of-reports-redesign, "indent and size
 * are driven by level, not by node kind".
 *
 * Weight is constant across every level: a section is always bold. Color is themeable per level — the
 * Theme panel's "L1/L2/L3 Section Text" rows (defaulting to `#002A2D`/`#00464A`/`#04646A`, a dark-to-teal
 * progression that reads as depth on its own) — so each level keeps its own hue until someone picks
 * otherwise. `isRowHovered` overrides the theme color with the same `#002A2D` darken every row's title
 * takes on hover (`reportTitleColorClassName`), one of the two "hover reveals the section you're in"
 * signals (row text, and the section's own background tint). Depth differentiates purely on size and
 * (optionally) the theme color per level; kind (section vs report) is the only thing allowed to change
 * weight, color, or tracking at rest, and hover is the one state that overrides both.
 *
 * Size, weight, and color only — no font family. A top-level title used to be pinned to the Poppins
 * display face, which meant it ignored the font chosen in the Theme panel while the rest of the
 * document followed it. The document is the customer's, so it uses their font throughout.
 *
 * Imperfect by design: a report row's name is a fixed `h3` and reports can sit at the root under no
 * heading at all, so this buys a readable outline rather than a valid one.
 * See spec/016-report-of-reports/004-redesign §4.
 */
const headingFor = (depth: number, isRowHovered?: boolean): { Heading: 'h2' | 'h3' | 'h4'; className: string } => ({
  Heading: depth <= 1 ? 'h2' : depth === 2 ? 'h3' : 'h4',
  className: `${levelFontSizeClassName(depth)} font-bold ${sectionTextColorClassName(depth, isRowHovered)}`,
});

const sectionTextColorClassName = (depth: number, isRowHovered?: boolean): string => {
  if (isRowHovered) {
    return 'text-[#002A2D]';
  }

  if (depth <= 1) {
    return 'text-[var(--section-l1-text-color)]';
  }

  if (depth === 2) {
    return 'text-[var(--section-l2-text-color)]';
  }

  return 'text-[var(--section-l3-text-color)]';
};

export default SectionTitle;
