import React, { useMemo, useState } from 'react';
import type { CanObservable } from '../../hooks/useCanObservable/useCanObservable';
import { useCanObservable } from '../../hooks/useCanObservable/useCanObservable';
import Stats from '../../Stats/Stats';
import { FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES } from '../../../jira/rollup/historical-adjusted-estimated-time/historical-adjusted-estimated-time';
import { buildTableRows } from './helpers/rows';
import { estimatedDaysOfWork, timedDays, rolledUpDays } from './helpers/cells';
import { EstimateBreakdownModal } from './components/EstimateBreakdownModal';
import type { EstimationIssue } from './types';

export interface EstimationTableProps {
  primaryIssuesOrReleasesObs: CanObservable<EstimationIssue[]>;
  allIssuesOrReleasesObs: CanObservable<EstimationIssue[]>;
}

/**
 * The Estimation Table report (React). Renders a recursive, indented table of issues with their
 * estimation columns (Summary, Estimated Days, Timed Days, Rolled Up Days); each value shows a
 * "last ➡ current" diff, and clicking an Estimated Days cell opens its calculation breakdown.
 *
 * Replaces [table-grid.js](src/canjs/reports/table-grid.js). Registered under the `table` report key
 * (feature flag `estimationTable`).
 */
export const EstimationTable: React.FC<EstimationTableProps> = (props) => {
  const primaryIssues = useCanObservable(props.primaryIssuesOrReleasesObs);
  const allIssues = useCanObservable(props.allIssuesOrReleasesObs);

  const rows = useMemo(() => buildTableRows(primaryIssues ?? [], allIssues ?? []), [primaryIssues, allIssues]);

  const [breakdownIssue, setBreakdownIssue] = useState<EstimationIssue | null>(null);

  const showStats = FEATURE_HISTORICALLY_ADJUSTED_ESTIMATES();

  return (
    <div className="p-2 mb-10">
      {showStats && (
        <Stats
          primaryIssuesOrReleasesObs={
            props.primaryIssuesOrReleasesObs as unknown as React.ComponentProps<
              typeof Stats
            >['primaryIssuesOrReleasesObs']
          }
        />
      )}
      <table>
        <thead>
          <tr>
            <th className="p-2">Summary</th>
            <th className="p-2">Estimated Days</th>
            <th className="p-2">Timed Days</th>
            <th className="p-2">Rolled Up Days</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const iconUrl = row.issue.issue?.fields?.['Issue Type']?.iconUrl;
            return (
              <tr key={`${row.issue.key}-${index}`}>
                <td style={{ paddingLeft: row.depth * 20 }} className="px-2 flex gap-2">
                  {iconUrl && <img src={iconUrl} alt="" className="inline-block" />}
                  {row.issue.type !== 'Release' && (
                    <a href={row.issue.url} target="_blank" rel="noreferrer" className="link inline-block">
                      {row.issue.key}
                    </a>
                  )}
                  <span className="text-ellipsis truncate inline-block max-w-96">{row.issue.summary}</span>
                </td>
                <td className="px-2 text-right cursor-pointer" onClick={() => setBreakdownIssue(row.issue)}>
                  {estimatedDaysOfWork(row.issue)}
                </td>
                <td className="px-2 text-right">{timedDays(row.issue)}</td>
                <td className="px-2 text-right">{rolledUpDays(row.issue)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <EstimateBreakdownModal issue={breakdownIssue} onClose={() => setBreakdownIssue(null)} />
    </div>
  );
};
