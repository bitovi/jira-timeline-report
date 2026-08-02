import type { LayoutNode, StoredNode } from './sections';

import { parseSections, toStoredSections } from './sections';

/**
 * The report-of-reports document tree, as a URL parameter.
 *
 * Every other report writes its settings to the URL as the user changes them, so the page can be
 * refreshed, bookmarked or pasted to a colleague and come back as the same report. This is what
 * lets a document do the same. See spec/016-report-of-reports/006-url-state.
 *
 * The value is exactly {@link toStoredSections} — the shape already saved to Jira, not a second
 * schema — so the two forms of a document are obviously the same thing, and a `sections` param
 * pasted into a saved report's field (or the other way round) is meaningful.
 */

/** Same name as the stored field, deliberately. */
export const SECTIONS_PARAM = 'sections';

export const encodeSections = (nodes: LayoutNode[]): string => JSON.stringify(toStoredSections(nodes));

/**
 * Reads the param. `null` means "the URL has no opinion" — the caller falls back to the open saved
 * report — which is why this can't simply return `[]` for an absent param.
 *
 * Tolerant otherwise, matching {@link parseSections}: malformed JSON is an empty document rather
 * than a thrown error, because a hand-mangled URL must not take the page down.
 */
export const decodeSections = (raw: string | null | undefined): LayoutNode[] | null => {
  if (raw == null) {
    return null;
  }

  try {
    return parseSections(JSON.parse(raw));
  } catch {
    return [];
  }
};

/**
 * What the param would be if the document were exactly as the open report has it saved — the
 * baseline `updateUrlParam` compares against, so an unmodified document leaves the URL at a clean
 * `?report=<id>` and a modified one grows a `sections` param. `"[]"` when nothing is open, so any
 * non-empty tree in a brand-new document writes.
 *
 * Deliberately round-tripped through `parseSections` rather than stringified straight from the
 * stored value: a document saved without a section's `children` key gains one on the way through,
 * so comparing against the raw stored JSON would report a difference that isn't one.
 */
export const sectionsBaseline = (savedReport?: { sections?: StoredNode[] }): string =>
  encodeSections(parseSections(savedReport?.sections));
