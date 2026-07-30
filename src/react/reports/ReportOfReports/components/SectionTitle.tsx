import type { FC } from 'react';

import React from 'react';
import InlineEdit from '@atlaskit/inline-edit';
import Textfield from '@atlaskit/textfield';

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
}

/**
 * A section's editable heading. Pure and prop-driven — the editing flag and every callback come from
 * the caller, so it can be storied and unit-tested without a document around it.
 *
 * Unlike `SaveReports`' `EditableTitle`, which writes the report *name* straight to Jira on confirm,
 * this **must not save**: a section title is document content, so it flows through the same
 * dirty → "Save report" path as every other layout edit. See
 * spec/016-report-of-reports/002-nested-sections.
 */
export const SectionTitle: FC<SectionTitleProps> = ({ title, depth, isEditing, onEdit, onConfirm, onCancel }) => {
  const { Heading, className } = headingFor(depth);
  const label = title || UNTITLED_SECTION;

  return (
    // InlineEdit's internal styles can't be reached through props; this drops its outer margin, and
    // makes the resting hit area read as editable text rather than as a button.
    //
    // `grow` only while editing: the field wants the width of the row, but at rest the hit area has
    // to end where the text ends. A full-width one would swallow clicks on the rest of the row —
    // which is what pins it — turning "click the row" into "rename the section".
    <div className={`[&>form>div]:!m-0 [&_button]:!cursor-text min-w-0 ${isEditing ? 'grow' : ''}`}>
      <InlineEdit
        isEditing={isEditing}
        onEdit={onEdit}
        defaultValue={title}
        onConfirm={onConfirm}
        onCancel={onCancel}
        editButtonLabel={label}
        editView={({ errorMessage, ...fieldProps }) => (
          // `autoFocus` is what makes a freshly added section land with its title ready to type.
          <Textfield {...fieldProps} autoFocus autoComplete="new-password" placeholder="Section title" />
        )}
        readView={() => (
          <Heading className={`${className} truncate ${title ? '' : 'italic font-normal text-slate-500'}`}>
            {label}
          </Heading>
        )}
      />
    </div>
  );
};

/**
 * Scales the heading with nesting. Two steps, not three: a top-level section titles a whole part of
 * the document, so it gets the display face; everything nested is one step down and matches the
 * weight a report row's name carries, since at that point they're peers in the same list.
 *
 * Imperfect by design: a report row's name is a fixed `h3` and reports can sit at the root under no
 * heading at all, so this buys a readable outline rather than a valid one.
 * See spec/016-report-of-reports/004-redesign §4.
 */
const headingFor = (depth: number): { Heading: 'h2' | 'h3' | 'h4'; className: string } => {
  if (depth <= 1) {
    return { Heading: 'h2', className: 'font-bitovipoppins text-lg font-bold' };
  }

  if (depth === 2) {
    return { Heading: 'h3', className: 'text-base font-semibold' };
  }

  return { Heading: 'h4', className: 'text-base font-semibold' };
};

export default SectionTitle;
