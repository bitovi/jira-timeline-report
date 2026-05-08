import React from 'react';
import type { CycleTimeStats, WipAgeResult } from './metrics';
import { InfoTooltip } from './Tooltip';

interface MetricsCardsProps {
  cycleTimeStats: CycleTimeStats | null;
  wipAgeResult: WipAgeResult | null;
  cycleTimeRangeDays: number;
  onCountClick?: () => void;
  onWipCountClick?: () => void;
  onSleExceedingClick?: () => void;
}

function Card({
  title,
  value,
  unit,
  sub,
  info,
  tooltip,
  onValueClick,
}: {
  title: string;
  value: string;
  unit: string;
  sub?: string;
  info?: string;
  tooltip?: string;
  onValueClick?: () => void;
}) {
  return (
    <div className="flex-1 min-w-0 bg-white border border-gray-200 rounded-lg p-4 text-center">
      <p className="text-sm text-gray-500 mb-2">
        {title}
        {tooltip && <InfoTooltip text={tooltip} />}
      </p>
      <div className="flex items-baseline justify-center gap-1">
        {onValueClick ? (
          <button
            onClick={onValueClick}
            className="flex items-baseline gap-1 text-blue-700 hover:text-blue-900 hover:underline"
          >
            <span className="text-3xl font-bold">{value}</span>
            <span className="text-sm">{unit}</span>
          </button>
        ) : (
          <>
            <span className="text-3xl font-bold text-gray-900">{value}</span>
            <span className="text-sm text-gray-500">{unit}</span>
          </>
        )}
      </div>
      {sub && <p className="text-xs text-gray-400 mt-2">{sub}</p>}
      {info && <p className="text-xs text-gray-400">{info}</p>}
    </div>
  );
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({
  cycleTimeStats,
  wipAgeResult,
  cycleTimeRangeDays,
  onCountClick,
  onWipCountClick,
  onSleExceedingClick,
}) => {
  const sle = cycleTimeStats?.p85 ?? null;
  const sleExceedingCount =
    wipAgeResult !== null && sle !== null ? wipAgeResult.items.filter((i) => i.age > sle).length : 0;
  const exceedsSle = sleExceedingCount > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Cycle Time</h3>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">
          Based on all items completed in the last {cycleTimeRangeDays} days
        </p>
        <div className="flex gap-4">
          <Card
            title={`Throughput (last ${cycleTimeRangeDays}d)`}
            value={cycleTimeStats ? String(cycleTimeStats.throughput) : '—'}
            unit="items"
            tooltip="The number of items completed in the selected date range. Click to view the list of completed items."
            onValueClick={cycleTimeStats ? onCountClick : undefined}
          />
          <Card
            title="Avg Cycle Time"
            value={cycleTimeStats ? String(cycleTimeStats.avg) : '—'}
            unit="days"
            tooltip="The mean number of days from when an item last moved from To Do to In Progress, to when it was completed. Sensitive to outliers — a few very long items can skew this upward."
          />
          <Card
            title="Med Cycle Time"
            value={cycleTimeStats ? String(cycleTimeStats.median) : '—'}
            unit="days"
            tooltip="The median number of days from when an item last moved from To Do to In Progress, to when it was completed. More reliable than the average when outliers are present — half of items finish faster than this, half slower."
          />
          <Card
            title="SLE (85th %ile)"
            value={sle !== null ? String(sle) : '—'}
            unit="days"
            sub="Service Level Expectation"
            info="85% of items complete within"
            tooltip="Service Level Expectation. Based on the 85th percentile of historical cycle times — 85% of items complete within this many days. In-progress items that exceed this threshold are flagged as needing attention."
          />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">Work In Progress (WIP)</h3>
        <p className="text-xs text-gray-400 mt-0.5 mb-3">Based on all items currently in an In Progress status</p>
        <div className="flex gap-4">
          <Card
            title="Items in Progress"
            value={wipAgeResult ? String(wipAgeResult.items.length) : '—'}
            unit="items"
            tooltip="The total number of items currently in an In Progress status category. Click to view the full list with individual ages."
            onValueClick={wipAgeResult ? onWipCountClick : undefined}
          />
          <Card
            title="Avg WIP Age"
            value={wipAgeResult ? String(wipAgeResult.avgAge) : '—'}
            unit="days"
            tooltip="The mean number of days in-progress items have been active, measured from when each item last transitioned from To Do into an In Progress status."
          />
          <Card
            title="Median WIP Age"
            value={wipAgeResult ? String(wipAgeResult.medianAge) : '—'}
            unit="days"
            tooltip="The median age of in-progress items. Half of active items have been in progress longer than this, half shorter. Less affected by a single very old item than the average."
          />
          <div
            className={`flex-1 min-w-0 bg-white border rounded-lg p-4 text-center ${exceedsSle ? 'border-red-400' : 'border-gray-200'}`}
          >
            <div
              className={`flex items-center justify-center gap-1 text-sm mb-2 ${exceedsSle ? 'text-red-600 font-medium' : 'text-gray-500'}`}
            >
              <span>Max WIP Age</span>
              {exceedsSle && <span>⚠</span>}
              <InfoTooltip text="The age of the single oldest in-progress item. Highlighted red when it exceeds the SLE, indicating a potential blocker that may need to be escalated or broken down." />
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span className={`text-3xl font-bold ${exceedsSle ? 'text-red-600' : 'text-gray-900'}`}>
                {wipAgeResult ? String(wipAgeResult.maxAge) : '—'}
              </span>
              <span className="text-sm text-gray-500">days</span>
            </div>
            {exceedsSle && sle !== null && <p className="text-xs text-red-500 mt-2">Exceeds SLE of {sle} days!</p>}
            {exceedsSle && sleExceedingCount === 1 && (
              <p className="text-xs text-red-400 mt-1">⚠ {wipAgeResult!.maxAgeKey} needs attention</p>
            )}
            {exceedsSle && sleExceedingCount > 1 && (
              <button onClick={onSleExceedingClick} className="text-xs text-red-500 font-medium mt-1 hover:underline">
                ⚠ Multiple issues need attention
              </button>
            )}
            {!exceedsSle && wipAgeResult && (
              <p className="text-xs text-gray-400 mt-2">Oldest active: {wipAgeResult.maxAgeKey}</p>
            )}
            {!wipAgeResult && <p className="text-xs text-gray-400 mt-2">No active items</p>}
          </div>
        </div>
      </div>
    </div>
  );
};
