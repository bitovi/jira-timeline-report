import type { FC } from 'react';

import React, { useEffect } from 'react';
import { IconButton } from '@atlaskit/button/new';
import PrinterIcon from '@atlaskit/icon/core/printer';

import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { computePrintScale } from './helpers/computePrintScale';

const CHART_CONTAINER_ID = 'react-report-container';

/**
 * `report-of-reports` prints the document it composes; each embedded report's wrapper carries
 * `print-avoid-break` so a page break lands between children rather than through one. `cards`
 * carries it per card, and printed unscaled from the secondary slot — it lives in
 * `#react-report-container` now, so `--print-scale` reaches it, but its grid wraps instead of
 * overflowing and so measures no wider than the page.
 */
const PRINTABLE_REPORT_TYPES = new Set(['due', 'start-due', 'report-of-reports', 'cards']);

/** See the matching rule in src/css/print.css. */
const MEASURING_CLASS = 'measuring-print-scale';

const applyPrintScale = () => {
  const element = document.getElementById(CHART_CONTAINER_ID);
  if (!element) {
    return;
  }

  // Reset first so `scrollWidth` reflects the natural (unscaled) content width.
  element.style.setProperty('--print-scale', '1');

  // A collapsed report-of-reports section is `display: none` on screen but prints in full, so it has
  // to be revealed for the measurement — otherwise a wide chart inside one adds no width here and
  // then prints clipped. Reading `scrollWidth` forces layout, so the class is in effect by then.
  element.classList.add(MEASURING_CLASS);
  try {
    const scale = computePrintScale(element.scrollWidth);
    element.style.setProperty('--print-scale', String(scale));
  } finally {
    element.classList.remove(MEASURING_CLASS);
  }
};

const resetPrintScale = () => {
  document.getElementById(CHART_CONTAINER_ID)?.style.removeProperty('--print-scale');
};

/**
 * "Download PDF" icon button for the Gantt/Scatter reports (spec/008-downloadable/printable.md).
 * Rendered next to `FullscreenToggle` in `SaveReports.tsx`; only visible for the report types in
 * {@link PRINTABLE_REPORT_TYPES}. Sets a `--print-scale` CSS variable (consumed by src/css/print.css) so wide
 * charts shrink to fit the printed page width, then triggers the browser's native print dialog
 * (Save as PDF). Also listens for `beforeprint`/`afterprint` so pressing Cmd/Ctrl+P directly
 * still gets the same scaling and cleanup. `.print-hidden` (print.css) keeps the button itself
 * off the printed page.
 */
export const PrintReportButton: FC = () => {
  const [primaryReportType] = usePrimaryReportType();
  const isPrintable = PRINTABLE_REPORT_TYPES.has(primaryReportType);

  useEffect(() => {
    if (!isPrintable) {
      return;
    }

    window.addEventListener('beforeprint', applyPrintScale);
    window.addEventListener('afterprint', resetPrintScale);
    return () => {
      window.removeEventListener('beforeprint', applyPrintScale);
      window.removeEventListener('afterprint', resetPrintScale);
    };
  }, [isPrintable]);

  if (!isPrintable) {
    return null;
  }

  const handleClick = () => {
    applyPrintScale();
    window.print();
  };

  return (
    <span className="contents print-hidden">
      <IconButton icon={PrinterIcon} label="Download PDF" onClick={handleClick} />
    </span>
  );
};

export default PrintReportButton;
