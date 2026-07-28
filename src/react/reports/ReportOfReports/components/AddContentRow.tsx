import type { FC } from 'react';
import type { LayoutPath } from '../model/sections';

import React from 'react';
import Button from '@atlaskit/button/new';

import { useReportLayout } from '../../../services/report-layout';
import { appendNode, canAddSectionAt, sectionNode } from '../model/sections';
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
}

/**
 * The `[ Add Report ] [ Add Section ]` pair that closes the document and every section in it.
 *
 * An editing affordance rather than content, so it carries `print-hidden` (src/css/print.css).
 * "Add Section" is hidden — not disabled — once nesting reaches `MAX_SECTION_DEPTH`: there is no
 * state to explain, the level simply doesn't take another section. See
 * spec/016-report-of-reports/002-nested-sections.
 */
export const AddContentRow: FC<AddContentRowProps> = ({ path, label }) => {
  const { sections, setSections } = useReportLayout();
  const { beginEditingSection, openReportPicker } = useDocumentEditing();
  const isRoot = path.length === 0;

  const addSection = () => {
    const section = sectionNode('');

    setSections(appendNode(sections, section, path));
    // A new section arrives blank, so it opens with its title field focused — otherwise the user has
    // to find and click an "Untitled section" to name the thing they just created.
    beginEditingSection(section.id);
  };

  // The visible text stays "Add Report" everywhere; only the accessible name is individuated, and it
  // still starts with the visible text (WCAG 2.5.3, Label in Name).
  const into = label ? ` to ${label}` : '';

  // Every row looks the same, at every level: a document has one of these per section, and four
  // primary-blue rows down the page would all be shouting. `default` is Atlaskit's appearance for a
  // tool rather than a call to action, which is what these are.
  return (
    <div className="flex justify-center gap-2 print-hidden">
      <Button
        spacing={isRoot ? 'default' : 'compact'}
        aria-label={label && `Add Report${into}`}
        onClick={() => openReportPicker(path)}
      >
        Add Report
      </Button>
      {canAddSectionAt(sections, path) && (
        <Button
          spacing={isRoot ? 'default' : 'compact'}
          aria-label={label && `Add Section${into}`}
          onClick={addSection}
        >
          Add Section
        </Button>
      )}
    </div>
  );
};

export default AddContentRow;
