/**
 * Prose overrides + table chrome for an `AdfDocument` rendered inline in a report row — shared by
 * `CommentReport`'s comment/status-update body and `InlineValue`'s rich-text (ADF/wiki) values, so the
 * two don't each keep their own copy of the same CSS. See spec/029-report-of-reports-redesign §5 and
 * spec/030-inline-custom-field-report.
 */

/** Apply on the wrapper around an `AdfDocument`/`WikiAdfDocument` — the table styles below are scoped to it. */
export const RICH_TEXT_BODY_CLASSNAME = 'comment-report-body';

/** List padding/gap and the shared text scale on `p`, `ul`, and `li`. */
export const RICH_TEXT_PROSE_CLASSNAME =
  'prose prose-sm prose-neutral max-w-none ' +
  'prose-p:my-1 prose-p:text-[13px] prose-p:leading-[1.55] prose-p:text-[#023538] ' +
  'prose-ul:my-1 prose-ul:flex prose-ul:flex-col prose-ul:gap-[6px] prose-ul:pl-[18px] ' +
  'prose-ul:text-[13px] prose-ul:leading-[1.55] prose-ul:text-[#023538] ' +
  'prose-ol:my-1 ' +
  'prose-li:my-0 prose-li:text-[13px] prose-li:leading-[1.55] prose-li:text-[#023538]';

/**
 * Table chrome for an ADF table inside a rich-text body — not `TableReport.tsx`'s own table, which is a
 * different, shared report type (Stats/TimeInStatus/FlowMetrics/IssueDebugModal) and stays out of scope
 * here. Scoped to `RICH_TEXT_BODY_CLASSNAME` rather than Tailwind utilities, following the pattern
 * `TableReport.tsx` uses for its own table (`TableReport.tsx:289-373`).
 */
export const RICH_TEXT_TABLE_STYLES = `
.${RICH_TEXT_BODY_CLASSNAME} table { width: 100%; border-collapse: collapse; }
.${RICH_TEXT_BODY_CLASSNAME} th {
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: .08em;
  text-transform: uppercase;
  color: #687879;
  border-bottom: 1px solid #DFE2E2;
  text-align: left;
}
.${RICH_TEXT_BODY_CLASSNAME} td {
  padding: 10px 12px;
  font-size: 13px;
  color: #023538;
  border-bottom: 1px solid #DFE2E2;
}
`;
