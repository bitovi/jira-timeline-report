import type { MeasureConfig } from '../../types';

/**
 * Measure the rendered width (in px) of each label using **batched** DOM writes-then-reads.
 *
 * This is the only DOM-touching (impure) piece of the scatter layout. All elements are
 * appended to a single off-screen container (writes), the container is attached once, then
 * every element is measured (reads) — so layout flushes a single time instead of once per
 * issue (Option A in measurement-batching.md). Widths are true measurements (never
 * estimated from character count) so proportional fonts are handled correctly.
 *
 * Returns a `text → width` map. Widths include the legacy `+3px` margin convention. Only
 * unique texts are measured. In jsdom `getBoundingClientRect().width` is `0`, so component
 * tests should mock this function / the hook and inject known widths.
 */
export const measureTextWidths = (config: MeasureConfig): Map<string, number> => {
  const widths = new Map<string, number>();

  if (typeof document === 'undefined') {
    return widths;
  }

  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'absolute',
    visibility: 'hidden',
    left: '-9999px',
    top: '0',
    whiteSpace: 'nowrap',
  });

  const textClass = config.isLotsOfIssues ? 'text-xs' : '';
  // Mirror IssueMarker's marker size so the measured box matches what actually renders.
  const radius = config.isLotsOfIssues ? 6 : 8;
  const uniqueTexts = [...new Set(config.texts)];

  // 1. WRITES ONLY — build all elements and append to the container.
  //
  // Each element mirrors IssueMarker's *default (left-side)* box so the measured width
  // matches the rendered element: an outer container that reserves marker room on the
  // right, wrapping a truncated, padded, max-width-clamped text label. The circular marker
  // itself is absolutely positioned in IssueMarker, so it contributes no layout width and
  // is intentionally omitted here.
  const elements = uniqueTexts.map((text) => {
    const outer = document.createElement('div');
    outer.className = 'release-timeline-item gap-1';
    Object.assign(outer.style, {
      display: 'inline-block',
      paddingRight: `${radius}px`,
    });

    const label = document.createElement('div');
    label.className = `truncate ${textClass} bg-neutral-41 rounded px-0.5`.trim();
    Object.assign(label.style, {
      maxWidth: textClass ? '260px' : '300px',
      paddingLeft: `${radius}px`,
      paddingRight: `${radius * 1.5}px`,
    });
    label.textContent = text;

    outer.appendChild(label);
    container.appendChild(outer);
    return { text, el: outer };
  });

  // 2. ONE ATTACH — single insertion into the document.
  document.body.appendChild(container);

  // 3. READS ONLY — measure every element (layout flushes once).
  for (const { text, el } of elements) {
    widths.set(text, el.getBoundingClientRect().width + 3); // +3px margin (legacy convention)
  }

  // 4. CLEANUP.
  document.body.removeChild(container);

  return widths;
};
