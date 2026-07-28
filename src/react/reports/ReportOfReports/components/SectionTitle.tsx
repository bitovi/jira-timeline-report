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
    // InlineEdit's internal styles can't be reached through props; this drops its outer margin.
    <div className="[&>form>div]:!m-0 grow">
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
          <Heading className={`${className} ${title ? '' : 'italic font-normal text-slate-500'}`}>{label}</Heading>
        )}
      />
    </div>
  );
};

/**
 * Scales the heading with nesting. Imperfect by design: a card's title is a fixed `h3` and cards can
 * sit at the root under no heading at all, so this buys a readable outline rather than a valid one.
 */
const headingFor = (depth: number): { Heading: 'h2' | 'h3' | 'h4'; className: string } => {
  if (depth <= 1) {
    return { Heading: 'h2', className: 'text-lg font-semibold' };
  }

  if (depth === 2) {
    return { Heading: 'h3', className: 'text-base font-semibold' };
  }

  return { Heading: 'h4', className: 'text-sm font-semibold' };
};

export default SectionTitle;
