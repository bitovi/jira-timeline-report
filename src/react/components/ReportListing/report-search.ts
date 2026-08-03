import type { DescribedReport } from './describe-report';

/** One run of text within a report name, flagged as matching the active query or not. */
export interface HighlightSegment {
  text: string;
  matched: boolean;
}

/**
 * Whether a report should survive the current query. Case-insensitive substring match against
 * the report's name and its type label ("gantt", "table", …) — the two things a person actually
 * remembers about a saved report. Pure, so both the Add Report modal and the Saved Reports page
 * filter identically.
 */
export const matchesQuery = (described: DescribedReport, query: string): boolean => {
  const lowerQuery = query.toLowerCase();

  return (
    described.report.name.toLowerCase().includes(lowerQuery) || described.typeName.toLowerCase().includes(lowerQuery)
  );
};

/** `described` narrowed to the rows matching `query`. An empty query filters nothing. */
export const filterReports = (described: DescribedReport[], query: string): DescribedReport[] =>
  query ? described.filter((d) => matchesQuery(d, query)) : described;

/** Splits `text` into plain / matched segments around every case-insensitive occurrence of `query`. */
export const highlightSegments = (text: string, query: string): HighlightSegment[] => {
  if (!query) {
    return [{ text, matched: false }];
  }

  const lowerText = text.toLowerCase();
  const lowerQuery = query.toLowerCase();
  const segments: HighlightSegment[] = [];
  let start = 0;
  let index = lowerText.indexOf(lowerQuery, start);

  while (index !== -1) {
    if (index > start) {
      segments.push({ text: text.slice(start, index), matched: false });
    }
    segments.push({ text: text.slice(index, index + query.length), matched: true });
    start = index + query.length;
    index = lowerText.indexOf(lowerQuery, start);
  }

  if (start < text.length) {
    segments.push({ text: text.slice(start), matched: false });
  }

  return segments;
};
