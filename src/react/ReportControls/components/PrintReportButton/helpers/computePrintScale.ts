// Approximate printable content width for a landscape page. Browsers don't expose the
// actual paper size to JS, so this assumes a conservative US Letter landscape page (11in)
// with the `@page { margin: 12mm }` set in src/css/print.css.
const PAGE_WIDTH_IN = 11;
const PAGE_MARGIN_MM = 12;
const PX_PER_IN = 96;
const MM_PER_IN = 25.4;

export const PRINT_PAGE_CONTENT_WIDTH_PX = PAGE_WIDTH_IN * PX_PER_IN - 2 * (PAGE_MARGIN_MM / MM_PER_IN) * PX_PER_IN;

/**
 * Returns a CSS transform scale (<= 1) that shrinks `contentWidthPx` down to fit within
 * `availableWidthPx`. Never scales up — content narrower than the page prints at 1:1.
 */
export const computePrintScale = (
  contentWidthPx: number,
  availableWidthPx: number = PRINT_PAGE_CONTENT_WIDTH_PX,
): number => {
  if (contentWidthPx <= 0 || availableWidthPx <= 0) {
    return 1;
  }

  return Math.min(1, availableWidthPx / contentWidthPx);
};
