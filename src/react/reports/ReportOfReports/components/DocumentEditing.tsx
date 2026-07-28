import type { FC, ReactNode } from 'react';
import type { LayoutPath } from '../model/sections';

import React, { createContext, useContext, useMemo, useState } from 'react';

export interface DocumentEditingContextValue {
  /** The section whose title field is open, by node id. Only ever one at a time. */
  editingSectionId: string | null;
  beginEditingSection: (id: string) => void;
  endEditingSection: () => void;
  /**
   * The container the report picker is adding into, or `null` when it's closed. A path, not a
   * boolean, because "Add Report" now appears in every section and the picker has to know which one
   * it was opened from. **`[]` is a valid value** — the document root — so the open check is
   * `!== null`, never plain truthiness.
   */
  pickerPath: LayoutPath | null;
  openReportPicker: (path: LayoutPath) => void;
  closeReportPicker: () => void;
}

const DocumentEditingContext = createContext<DocumentEditingContextValue | null>(null);

/**
 * Transient editing state for one report-of-reports document: which section title is open, and where
 * the report picker would add. None of it is part of the document, so it never reaches
 * `ReportLayoutProvider` (which holds the tree itself) and nothing here is saved.
 *
 * It's a context rather than props for the reason `NodeControls` documents: the document renders
 * recursively, and this state has to be reachable at any depth without threading callbacks through
 * every level. `ReportOfReports` mounts the provider itself, so no caller or test has to.
 * See spec/016-report-of-reports/002-nested-sections.
 */
export const useDocumentEditing = (): DocumentEditingContextValue => {
  const context = useContext(DocumentEditingContext);

  if (!context) {
    throw new Error('Cannot use useDocumentEditing outside of its provider');
  }

  return context;
};

export const DocumentEditingProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [pickerPath, setPickerPath] = useState<LayoutPath | null>(null);

  const value = useMemo<DocumentEditingContextValue>(
    () => ({
      editingSectionId,
      beginEditingSection: (id) => setEditingSectionId(id),
      endEditingSection: () => setEditingSectionId(null),
      pickerPath,
      openReportPicker: (path) => setPickerPath(path),
      closeReportPicker: () => setPickerPath(null),
    }),
    [editingSectionId, pickerPath],
  );

  return <DocumentEditingContext.Provider value={value}>{children}</DocumentEditingContext.Provider>;
};
