import type { FC, ReactNode } from 'react';
import type { LayoutNode, StoredNode } from '../../reports/ReportOfReports/model/sections';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { parseSections, sameSections, setNodeOverride } from '../../reports/ReportOfReports/model/sections';
import {
  SECTIONS_PARAM,
  decodeSections,
  encodeSections,
  sectionsBaseline,
} from '../../reports/ReportOfReports/model/documentParam';
import { getUrlParamValue, pushStateObservable, updateUrlParam } from '../../../canjs/routing/state-storage';

export interface ReportLayoutContextValue {
  /** The report-of-reports document tree currently being edited. Empty for every other report. */
  sections: LayoutNode[];
  setSections: (sections: LayoutNode[]) => void;
  /**
   * Records one configuration override on an embedded report's node — `undefined` clears it. Backs
   * "sort a Table child, refresh, the sort survives".
   *
   * Referentially stable for the provider's whole lifetime, deliberately: it is handed to a
   * memoized `ChildReport`, and a callback rebuilt per render would defeat that memo (and with it
   * the reason a document doesn't reconcile every embedded chart on every hover).
   */
  setNodeOverrideOn: (nodeId: string, key: string, value: string | undefined) => void;
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

/**
 * The provider owns the live tree and mirrors it into the `sections` URL param, rather than the
 * tree moving into `routeData` alongside every other setting. Three reasons: the tree's only
 * consumers are React (the document body and `SaveReports`); `route-data.js` is the last thing the
 * React rewrite still has to delete (spec/011), so new props there move backwards; and keeping the
 * in-memory tree authoritative is what protects node identity — see `adopt` below.
 * See spec/016-report-of-reports/006-url-state.
 */
export const ReportLayoutProvider: FC<ReportLayoutProviderProps> = ({ children, savedReport }) => {
  // URL first, then the saved report — the same precedence `makeParamAndReportDataReducer` gives
  // every other setting. Read in the lazy initializer so a refreshed document paints from the URL
  // rather than flashing the as-saved version first.
  const [sections, setSectionsState] = useState<LayoutNode[]>(
    () => decodeSections(getUrlParamValue(SECTIONS_PARAM)) ?? parseSections(savedReport?.sections),
  );

  // Keyed by content, not reference: `routeData.reportsData` is replaced on every reports fetch, so
  // an unchanged record still arrives as a fresh object.
  const savedKey = savedReport ? `${savedReport.id}:${JSON.stringify(savedReport.sections ?? [])}` : '';

  // Assigned while rendering so the URL subscription and the setters below can stay registered once
  // and still see current values. Without them every edit would resubscribe, and `setSections`
  // would change identity on every render — it is a `useMemo` dependency of half the document.
  const savedReportRef = useRef(savedReport);
  const sectionsRef = useRef(sections);
  savedReportRef.current = savedReport;
  sectionsRef.current = sections;

  /** Takes the caller's tree as-is. Never re-parses — see {@link setSections}. */
  const adopt = useCallback((next: LayoutNode[]) => {
    sectionsRef.current = next;
    setSectionsState(next);
  }, []);

  /**
   * Adopts the tree and writes it through to the URL — in that order, so the write's own
   * `pushStateObservable` tick finds `sectionsRef` already up to date and recognises it as ours.
   *
   * The param is written only when the tree differs from what the open report has saved, and
   * deleted the moment it matches again. That is the same rule every other setting follows, and it
   * is what the document's dirty flag is derived from: `paramsMatchReport` reports dirty iff any
   * param other than `settings` and `report` is left in the URL.
   *
   * State is set from the caller's tree, never from a re-parse of what we just wrote. A re-parse
   * would mint new node ids, remount every `ChildReport`, and a remounted child refetches from
   * Jira — so this is the load-bearing line of the whole file.
   */
  const setSections = useCallback(
    (next: LayoutNode[]) => {
      adopt(next);
      updateUrlParam(SECTIONS_PARAM, encodeSections(next), sectionsBaseline(savedReportRef.current));
    },
    [adopt],
  );

  /**
   * Reads the current tree from the ref rather than taking it as an argument, so the identity of
   * this callback never changes — see {@link ReportLayoutContextValue.setNodeOverrideOn}. Writes
   * through `setSections`, which is why per-child overrides and structural edits are one writer to
   * one param and can't interleave.
   */
  const setNodeOverrideOn = useCallback(
    (nodeId: string, key: string, value: string | undefined) => {
      const next = setNodeOverride(sectionsRef.current, nodeId, key, value);

      // Same reference means the override was already what it would be set to — a report
      // re-announcing its current value must not flip the dirty flag.
      if (next !== sectionsRef.current) {
        setSections(next);
      }
    },
    [setSections],
  );

  /**
   * Restores the tree as last saved, and (because the restored tree matches the baseline) clears
   * the param with it.
   *
   * `SaveReports.resetChanges` also rewrites the whole query string to `?report=<id>`, which would
   * arrive here as an external change and do the same thing. Kept anyway: it makes the reset
   * synchronous and independent of tick ordering, and it is the only reset for a document with no
   * `?report=` at all.
   */
  const resetSections = useCallback(() => setSections(parseSections(savedReportRef.current?.sections)), [setSections]);

  useEffect(() => {
    // Back/forward, `resetChanges`, and any other external rewrite of the URL land here. Our own
    // writes do too — and are ignored, because `setSections` updated `sectionsRef` first.
    const onUrlChange = () => {
      const decoded = decodeSections(getUrlParamValue(SECTIONS_PARAM));
      // An absent param is not an empty document: it means the URL has no opinion, so the open
      // report's saved tree is what it describes. That is what makes navigating back to a plain
      // `?report=<id>` restore the document as saved.
      const next = decoded ?? parseSections(savedReportRef.current?.sections);

      if (!sameSections(next, sectionsRef.current)) {
        adopt(next);
      }
    };

    pushStateObservable.on(onUrlChange);

    return () => pushStateObservable.off(onUrlChange);
  }, [adopt]);

  useEffect(() => {
    // Creating a report points the URL at a brand-new id while `routeData.reportsData` still predates
    // it, so for a moment no record exists for the open report. Seeding from "nothing" there would
    // wipe the document the user just saved.
    if (!savedReport) {
      return;
    }

    // The URL outranks the saved report, so a document with edits in it must not be stomped when a
    // `reportsData` refetch re-delivers the as-saved record.
    if (getUrlParamValue(SECTIONS_PARAM) != null) {
      return;
    }

    // Keep the current tree when it already matches what was saved — the state just after a save.
    // Re-parsing there would mint new node ids and remount every child report, and a remounted
    // child refetches from Jira.
    const saved = parseSections(savedReport.sections);

    if (!sameSections(sectionsRef.current, saved)) {
      adopt(saved);
    }
  }, [savedKey, adopt]);

  const value = useMemo(
    () => ({ sections, setSections, setNodeOverrideOn, resetSections }),
    [sections, setSections, setNodeOverrideOn, resetSections],
  );

  return <ReportLayoutContext.Provider value={value}>{children}</ReportLayoutContext.Provider>;
};
