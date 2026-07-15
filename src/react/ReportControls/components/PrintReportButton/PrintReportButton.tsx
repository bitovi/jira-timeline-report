import type { FC } from 'react';

import React, { useEffect } from 'react';
import { IconButton } from '@atlaskit/button/new';
import PrinterIcon from '@atlaskit/icon/core/printer';

import { usePrimaryReportType } from '../../hooks/usePrimaryReportType';
import { computePrintScale } from './helpers/computePrintScale';

const CHART_CONTAINER_ID = 'react-report-container';

const applyPrintScale = () => {
  const element = document.getElementById(CHART_CONTAINER_ID);
  if (!element) {
    return;
  }

  // Reset first so `scrollWidth` reflects the natural (unscaled) content width.
  element.style.setProperty('--print-scale', '1');
  const scale = computePrintScale(element.scrollWidth);
  element.style.setProperty('--print-scale', String(scale));
};

const resetPrintScale = () => {
  document.getElementById(CHART_CONTAINER_ID)?.style.removeProperty('--print-scale');
};

/**
 * "Download PDF" icon button for the Gantt/Scatter reports (spec/008-downloadable/printable.md).
 * Rendered next to `FullscreenToggle` in `SaveReports.tsx`; only visible for the `due`/`start-due`
 * report types. Sets a `--print-scale` CSS variable (consumed by src/css/print.css) so wide
 * charts shrink to fit the printed page width, then triggers the browser's native print dialog
 * (Save as PDF). Also listens for `beforeprint`/`afterprint` so pressing Cmd/Ctrl+P directly
 * still gets the same scaling and cleanup. `.print-hidden` (print.css) keeps the button itself
 * off the printed page.
 */
export const PrintReportButton: FC = () => {
  const [primaryReportType] = usePrimaryReportType();
  const isPrintable = primaryReportType === 'due' || primaryReportType === 'start-due';

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
