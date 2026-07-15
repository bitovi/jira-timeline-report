import type { FC } from 'react';

import React from 'react';

import { useRouteData } from '../hooks/useRouteData/useRouteData';

/**
 * Print-only report header (date + JQL). Hidden on screen via the `.print-only` utility in
 * [`src/css/print.css`](../../css/print.css); shown when printing/saving as PDF. The report
 * title itself isn't repeated here — it's already visible on the printed page via the
 * on-screen report name (`EditableTitle`, in `#saved-reports`, which print.css keeps visible).
 * See spec/008-downloadable/printable.md.
 */
const PrintHeader: FC = () => {
  const [jql] = useRouteData<string>('jql');
  const dateLabel = new Date().toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="print-only pb-4">
      <p className="text-sm text-neutral-701">{dateLabel}</p>
      {jql ? <p className="text-xs text-neutral-701 break-all">{jql}</p> : null}
    </div>
  );
};

export default PrintHeader;
