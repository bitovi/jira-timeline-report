import type { FC, ReactNode } from 'react';
import type { LayoutNode, StoredNode } from '../../reports/ReportOfReports/model/sections';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { parseSections, sameSections } from '../../reports/ReportOfReports/model/sections';

export interface ReportLayoutContextValue {
  /** The report-of-reports document tree currently being edited. Empty for every other report. */
  sections: LayoutNode[];
  setSections: (sections: LayoutNode[]) => void;
  /** Discards edits and restores the tree as last saved. Backs "Reset changes". */
  resetSections: () => void;
}

const ReportLayoutContext = createContext<ReportLayoutContextValue | null>(null);

/**
 * Holds the report-of-reports document tree while it's being edited.
 *
 * It lives here rather than inside `ReportOfReports` because the tree has more than one consumer,
 * and they sit in sibling subtrees under the shell: the report body renders it, while `SaveReports`
 * persists it and derives the dirty flag from it. Mounted above both in `TimelineReport`.
 * See spec/016-report-of-reports.
 */
export const useReportLayout = (): ReportLayoutContextValue => {
  const context = useContext(ReportLayoutContext);

  if (!context) {
    throw new Error('Cannot use useReportLayout outside of its provider');
  }

  return context;
};

interface ReportLayoutProviderProps {
  children: ReactNode;
  /**
   * The open saved report's record, once it has loaded. Its **presence** is load-bearing: absent
   * means "no document to seed from yet" — either nothing is open, or the record hasn't arrived —
   * and the tree on screen is left alone. Present with no `sections` means "this report genuinely
   * has no document", which does reset the tree.
   */
  savedReport?: { id: string; sections?: StoredNode[] };
}

export const ReportLayoutProvider: FC<ReportLayoutProviderProps> = ({ children, savedReport }) => {
  const [sections, setSections] = useState<LayoutNode[]>(() => parseSections(savedReport?.sections));

  // Keyed by content, not reference: `routeData.reportsData` is replaced on every reports fetch, so
  // an unchanged record still arrives as a fresh object.
  const savedKey = savedReport ? `${savedReport.id}:${JSON.stringify(savedReport.sections ?? [])}` : '';

  const resetSections = useCallback(() => setSections(parseSections(savedReport?.sections)), [savedKey]);

  useEffect(() => {
    // Creating a report points the URL at a brand-new id while `routeData.reportsData` still predates
    // it, so for a moment no record exists for the open report. Seeding from "nothing" there would
    // wipe the document the user just saved.
    if (!savedReport) {
      return;
    }

    // Keep the current tree when it already matches what was saved — the state just after a save.
    // Re-parsing there would mint new node ids and remount every child report, and a remounted
    // child refetches from Jira.
    setSections((current) => {
      const saved = parseSections(savedReport.sections);

      return sameSections(current, saved) ? current : saved;
    });
  }, [savedKey]);

  const value = useMemo(() => ({ sections, setSections, resetSections }), [sections, resetSections]);

  return <ReportLayoutContext.Provider value={value}>{children}</ReportLayoutContext.Provider>;
};
