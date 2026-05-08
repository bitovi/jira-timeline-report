import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import Tabs, { Tab, TabList, TabPanel } from '@atlaskit/tabs';
import type { MetricsIssue } from './adapter';
import { getInProgressDate } from './metrics';
import { InfoTooltip } from './Tooltip';

interface FlowChartsProps {
  doneIssues: MetricsIssue[];
  allProjectKeys: string[];
  projectMedians: Array<{ projectKey: string; median: number }>;
  cycleTimeRangeDays: number;
  statusCategoryMap: Map<string, string>;
  onHistogramBarClick?: (issueKeys: string[]) => void;
}

interface ScatterPoint {
  xFrac: number;
  days: number;
  projectKey: string;
  issueKey: string;
  url?: string;
  inProgressDateStr: string;
  doneDateStr: string;
  dayBucket: number; // Math.floor(dateMs / DAY_MS) — groups issues on the same calendar day
}

interface TooltipState {
  clientX: number;
  clientY: number;
  items: ScatterPoint[];
}

interface HistogramBin {
  label: string;
  count: number;
  issueKeys: string[];
}

interface ProjectHistogram {
  projectKey: string;
  color: string;
  bins: HistogramBin[];
  maxCount: number;
  total: number;
  maxCt: number;
}

const PROJECT_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // emerald
  '#f59e0b', // amber
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#ec4899', // pink
  '#6366f1', // indigo
];

function colorForProject(projectKey: string, sortedKeys: string[]): string {
  const idx = sortedKeys.indexOf(projectKey);
  return PROJECT_COLORS[idx % PROJECT_COLORS.length];
}

const fmt = (d: Date) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

// Scatter chart constants
const W = 600;
const H = 260;
const PAD_L = 40;
const PAD_R = 14;
const PAD_T = 16;
const PAD_B = 40;
const PW = W - PAD_L - PAD_R;
const PH = H - PAD_T - PAD_B;
const DAY_MS = 86400000;

// Histogram chart constants
const HW = 600;
const HH = 260;
const HPL = 36;
const HPR = 12;
const HPT = 16;
const HPB = 56;
const HPW = HW - HPL - HPR;
const HPH = HH - HPT - HPB;
const BIN_COUNT = 10;

function niceMax(val: number): number {
  if (val <= 0) return 10;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  return Math.ceil(val / mag) * mag;
}

function yTicks(max: number): number[] {
  const step = max / 4;
  return [0, step, step * 2, step * 3, max];
}

function histNiceMax(n: number): number {
  if (n <= 0) return 5;
  if (n <= 5) return 5;
  if (n <= 10) return 10;
  return Math.ceil(n / 5) * 5;
}

export const FlowCharts: React.FC<FlowChartsProps> = ({
  doneIssues,
  allProjectKeys,
  projectMedians,
  cycleTimeRangeDays,
  statusCategoryMap,
  onHistogramBarClick,
}) => {
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [pinnedTooltip, setPinnedTooltip] = useState<TooltipState | null>(null);
  const [histBarTooltip, setHistBarTooltip] = useState<{
    clientX: number;
    clientY: number;
    label: string;
    count: number;
  } | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const pinnedTooltipRef = useRef<HTMLDivElement>(null);
  const histBarTooltipRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = tooltipRef.current;
    if (!el || !tooltip) return;
    const MARGIN = 12;
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    el.style.left = `${Math.min(tooltip.clientX + MARGIN, window.innerWidth - tipW - MARGIN)}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(tooltip.clientY - 10, window.innerHeight - tipH - MARGIN))}px`;
  }, [tooltip]);

  useLayoutEffect(() => {
    const el = pinnedTooltipRef.current;
    if (!el || !pinnedTooltip) return;
    const MARGIN = 12;
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    el.style.left = `${Math.min(pinnedTooltip.clientX + MARGIN, window.innerWidth - tipW - MARGIN)}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(pinnedTooltip.clientY - 10, window.innerHeight - tipH - MARGIN))}px`;
  }, [pinnedTooltip]);

  useLayoutEffect(() => {
    const el = histBarTooltipRef.current;
    if (!el || !histBarTooltip) return;
    const MARGIN = 12;
    const tipW = el.offsetWidth;
    const tipH = el.offsetHeight;
    el.style.left = `${Math.min(histBarTooltip.clientX + MARGIN, window.innerWidth - tipW - MARGIN)}px`;
    el.style.top = `${Math.max(MARGIN, Math.min(histBarTooltip.clientY - 10, window.innerHeight - tipH - MARGIN))}px`;
  }, [histBarTooltip]);

  const scatterData = useMemo(() => {
    const now = Date.now();
    const queryStart = now - cycleTimeRangeDays * DAY_MS;

    const raw: (ScatterPoint & { dateMs: number })[] = [];
    for (const issue of doneIssues) {
      const inProgressDate = getInProgressDate(issue, statusCategoryMap);
      const resolutionDate = issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null;
      if (!inProgressDate || !resolutionDate) continue;
      const ct = Math.floor((resolutionDate.getTime() - inProgressDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const dateMs = resolutionDate.getTime();
      if (dateMs < queryStart || dateMs > now) continue;
      raw.push({
        dateMs,
        days: ct,
        projectKey: issue.projectKey,
        issueKey: issue.key,
        url: issue.url,
        inProgressDateStr: fmt(inProgressDate),
        doneDateStr: fmt(resolutionDate),
        dayBucket: Math.floor(dateMs / DAY_MS),
        xFrac: 0,
      });
    }

    if (raw.length === 0) return null;

    const displayRange = now - queryStart;
    const sortedProjectKeys = [...new Set(raw.map((p) => p.projectKey))].sort();

    const points: ScatterPoint[] = raw.map((p) => ({
      ...p,
      xFrac: displayRange > 0 ? (p.dateMs - queryStart) / displayRange : 0.5,
    }));

    return { points, sortedProjectKeys, displayStart: queryStart, displayEnd: now };
  }, [doneIssues, cycleTimeRangeDays, statusCategoryMap]);

  const scatterMax = useMemo(() => {
    const maxCt = scatterData ? Math.max(...scatterData.points.map((p) => p.days)) : 0;
    const maxMedian = projectMedians.length ? Math.max(...projectMedians.map((m) => m.median)) : 0;
    return niceMax(Math.ceil(Math.max(maxCt, maxMedian) * 1.15));
  }, [scatterData, projectMedians]);

  // Group medians that land on the same pixel row. When stacked, each line gets
  // an offset so their dashes interleave — producing alternating color segments
  // that signal multiple teams share the same median.
  const medianGroups = useMemo(() => {
    const groups: { y: number; items: { projectKey: string; color: string }[] }[] = [];
    for (const { projectKey, median } of projectMedians) {
      const y = PAD_T + PH - (median / scatterMax) * PH;
      const color = colorForProject(projectKey, allProjectKeys);
      const existing = groups.find((g) => Math.abs(g.y - y) < 1.5);
      if (existing) {
        existing.items.push({ projectKey, color });
      } else {
        groups.push({ y, items: [{ projectKey, color }] });
      }
    }
    return groups;
  }, [projectMedians, scatterMax, allProjectKeys]);

  const histogramData = useMemo((): ProjectHistogram[] | null => {
    const byProject = new Map<string, { key: string; ct: number }[]>();
    for (const issue of doneIssues) {
      const ip = getInProgressDate(issue, statusCategoryMap);
      const rd = issue.fields.resolutiondate ? new Date(issue.fields.resolutiondate) : null;
      if (!ip || !rd) continue;
      const ct = Math.floor((rd.getTime() - ip.getTime()) / (1000 * 60 * 60 * 24)) + 1;
      const arr = byProject.get(issue.projectKey) ?? [];
      arr.push({ key: issue.key, ct });
      byProject.set(issue.projectKey, arr);
    }
    if (byProject.size === 0) return null;

    return [...byProject.entries()]
      .map(([projectKey, items]): ProjectHistogram => {
        const cts = items.map((item) => item.ct);
        const maxCt = Math.max(...cts);

        // Log-spaced float edges: edge[i] = maxCt^(i/10), starting from 0.
        const logBase = Math.log(maxCt);
        const edges = Array.from({ length: BIN_COUNT + 1 }, (_, i) =>
          i === 0 ? 0 : Math.exp((i / BIN_COUNT) * logBase),
        );

        // Assign each issue to a bin by its float edge range.
        const binItems = Array.from({ length: BIN_COUNT }, () => [] as { key: string; ct: number }[]);
        for (const item of items) {
          let bin = BIN_COUNT - 1;
          for (let i = 0; i < BIN_COUNT - 1; i++) {
            if (item.ct <= edges[i + 1]) {
              bin = i;
              break;
            }
          }
          binItems[bin].push(item);
        }

        // Derive integer label range per bin. Filter impossible ranges (lo > hi) —
        // these arise when two float edges round to the same integer, producing an
        // empty phantom bin that would duplicate the adjacent label.
        const bins: HistogramBin[] = [];
        for (let i = 0; i < BIN_COUNT; i++) {
          const lo = Math.floor(edges[i]) + 1;
          const hi = i === BIN_COUNT - 1 ? maxCt : Math.floor(edges[i + 1]);
          if (lo > hi) continue;
          const label = lo === hi ? `${lo}d` : `${lo}–${hi}d`;
          bins.push({ count: binItems[i].length, label, issueKeys: binItems[i].map((item) => item.key) });
        }

        const maxCount = bins.reduce((m, b) => Math.max(m, b.count), 1);
        return {
          projectKey,
          color: colorForProject(projectKey, allProjectKeys),
          bins,
          maxCount,
          total: cts.length,
          maxCt,
        };
      })
      .sort((a, b) => a.projectKey.localeCompare(b.projectKey));
  }, [doneIssues, statusCategoryMap, allProjectKeys]);

  const getStacked = (pt: ScatterPoint) =>
    scatterData!.points.filter((p) => p.days === pt.days && p.dayBucket === pt.dayBucket);

  const handleEnter = (e: React.MouseEvent, pt: ScatterPoint) => {
    if (pinnedTooltip) return;
    setTooltip({ clientX: e.clientX, clientY: e.clientY, items: getStacked(pt) });
  };

  const handleMove = (e: React.MouseEvent) =>
    setTooltip((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev));

  const handleClick = (e: React.MouseEvent, pt: ScatterPoint) => {
    e.stopPropagation();
    setTooltip(null);
    setPinnedTooltip({ clientX: e.clientX, clientY: e.clientY, items: getStacked(pt) });
  };

  const noData = !scatterData && !histogramData;

  return (
    <div>
      <Tabs id="flow-chart-view">
        <TabList>
          <Tab>Scatter Plot</Tab>
          <Tab>Team by Team Histogram</Tab>
        </TabList>

        <TabPanel>
          <div className="bg-white border border-gray-200 rounded-lg p-5 mt-2 w-full">
            <h3 className="text-sm font-semibold text-gray-800 mb-0.5">
              Cycle Time Scatter
              <InfoTooltip text="Each dot represents a completed item. The x-axis is the date it was completed; the y-axis is how many days it took (from last To Do → In Progress transition to done). Dashed lines show the median cycle time per team." />
            </h3>
            <p className="text-xs text-gray-400 mb-3">Completed items over last {cycleTimeRangeDays} days</p>

            {noData || !scatterData ? (
              <p className="text-sm text-gray-400">No completed items in range.</p>
            ) : (
              <>
                <svg
                  width="100%"
                  viewBox={`0 0 ${W} ${H}`}
                  style={{ display: 'block', overflow: 'visible' }}
                  onMouseLeave={() => setTooltip(null)}
                >
                  {yTicks(scatterMax).map((tick) => {
                    const y = PAD_T + PH - (tick / scatterMax) * PH;
                    return (
                      <g key={tick}>
                        <line x1={PAD_L} y1={y} x2={PAD_L + PW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                        <text x={PAD_L - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                          {Math.round(tick)}
                        </text>
                      </g>
                    );
                  })}

                  {([0, 0.5, 1] as const).map((frac) => {
                    const dateMs =
                      scatterData.displayStart + frac * (scatterData.displayEnd - scatterData.displayStart);
                    const label = new Date(dateMs).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    return (
                      <text key={frac} x={PAD_L + frac * PW} y={H - 4} textAnchor="middle" fontSize="10" fill="#9ca3af">
                        {label}
                      </text>
                    );
                  })}

                  <line x1={PAD_L} y1={PAD_T} x2={PAD_L} y2={PAD_T + PH} stroke="#e5e7eb" strokeWidth="1" />
                  <line x1={PAD_L} y1={PAD_T + PH} x2={PAD_L + PW} y2={PAD_T + PH} stroke="#e5e7eb" strokeWidth="1" />

                  {medianGroups.map(({ y, items }) => {
                    const n = items.length;
                    const dash = 5;
                    const gap = 3;
                    const period = n * (dash + gap);
                    return items.map(({ projectKey, color }, i) => (
                      <line
                        key={projectKey}
                        x1={PAD_L}
                        y1={y}
                        x2={PAD_L + PW}
                        y2={y}
                        stroke={color}
                        strokeWidth="1.5"
                        strokeDasharray={n === 1 ? '5 3' : `${dash} ${period - dash}`}
                        strokeDashoffset={n === 1 ? undefined : i * (dash + gap)}
                      />
                    ));
                  })}

                  {scatterData.points.map((pt, i) => {
                    const color = colorForProject(pt.projectKey, allProjectKeys);
                    const cx = PAD_L + pt.xFrac * PW;
                    const cy = PAD_T + PH - (pt.days / scatterMax) * PH;
                    return (
                      <g key={i}>
                        <circle
                          cx={cx}
                          cy={cy}
                          r="3.5"
                          fill={color}
                          fillOpacity="0.6"
                          stroke={color}
                          strokeWidth="0.5"
                          strokeOpacity="0.8"
                          style={{ pointerEvents: 'none' }}
                        />
                        <circle
                          cx={cx}
                          cy={cy}
                          r="8"
                          fill="transparent"
                          style={{ cursor: 'pointer' }}
                          onMouseEnter={(e) => handleEnter(e, pt)}
                          onMouseMove={handleMove}
                          onClick={(e) => handleClick(e, pt)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {scatterData.sortedProjectKeys.length > 0 && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                    {scatterData.sortedProjectKeys.map((pk) => (
                      <div key={pk} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <span
                          style={{ backgroundColor: colorForProject(pk, allProjectKeys) }}
                          className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        />
                        {pk}
                      </div>
                    ))}
                    {projectMedians.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-gray-400">
                        <svg width="18" height="10" style={{ flexShrink: 0 }}>
                          <line x1="0" y1="5" x2="18" y2="5" stroke="#9ca3af" strokeWidth="1.5" strokeDasharray="4 3" />
                        </svg>
                        team median
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </TabPanel>

        <TabPanel>
          {!histogramData ? (
            <p className="text-sm text-gray-400 mt-2 w-full">No completed items in range.</p>
          ) : (
            <div className="flex flex-col gap-4 mt-2 w-full">
              {histogramData.map((proj) => {
                const yMax = histNiceMax(proj.maxCount);
                const histYTicks = [0, Math.round(yMax / 2), yMax];
                return (
                  <div key={proj.projectKey} className="bg-white border border-gray-200 rounded-lg p-5">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
                        style={{ backgroundColor: proj.color }}
                      />
                      <h3 className="text-sm font-semibold text-gray-800">{proj.projectKey}</h3>
                      <span className="text-xs text-gray-400">
                        {proj.total} item{proj.total !== 1 ? 's' : ''} · max {proj.maxCt}d
                      </span>
                    </div>
                    <p className="text-xs text-gray-400 mb-3">
                      Cycle time distribution · last {cycleTimeRangeDays} days
                    </p>
                    <svg width="100%" viewBox={`0 0 ${HW} ${HH}`} style={{ display: 'block', overflow: 'visible' }}>
                      {histYTicks.map((tick) => {
                        const y = HPT + HPH - (tick / yMax) * HPH;
                        return (
                          <g key={tick}>
                            <line x1={HPL} y1={y} x2={HPL + HPW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
                            <text x={HPL - 4} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                              {tick}
                            </text>
                          </g>
                        );
                      })}

                      <line x1={HPL} y1={HPT} x2={HPL} y2={HPT + HPH} stroke="#e5e7eb" strokeWidth="1" />
                      <line x1={HPL} y1={HPT + HPH} x2={HPL + HPW} y2={HPT + HPH} stroke="#e5e7eb" strokeWidth="1" />

                      {(() => {
                        const dynBinW = proj.bins.length > 0 ? HPW / proj.bins.length : HPW / BIN_COUNT;
                        const dynBarW = Math.max(dynBinW - 3, 1);
                        return proj.bins.map((bin, i) => {
                          const binX = HPL + i * dynBinW;
                          const barX = binX + (dynBinW - dynBarW) / 2;
                          const barH = yMax > 0 ? (bin.count / yMax) * HPH : 0;
                          const barY = HPT + HPH - barH;
                          const labelX = binX + dynBinW / 2;
                          const labelY = HPT + HPH + 6;
                          return (
                            <g
                              key={i}
                              style={{ cursor: bin.count > 0 ? 'pointer' : 'default' }}
                              onMouseEnter={(e) =>
                                setHistBarTooltip({
                                  clientX: e.clientX,
                                  clientY: e.clientY,
                                  label: bin.label,
                                  count: bin.count,
                                })
                              }
                              onMouseMove={(e) =>
                                setHistBarTooltip((prev) =>
                                  prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev,
                                )
                              }
                              onMouseLeave={() => setHistBarTooltip(null)}
                              onClick={() => {
                                if (bin.count > 0) onHistogramBarClick?.(bin.issueKeys);
                              }}
                            >
                              <rect x={barX} y={HPT} width={dynBarW} height={HPH} fill="transparent" />
                              {bin.count > 0 && (
                                <rect
                                  x={barX}
                                  y={barY}
                                  width={dynBarW}
                                  height={barH}
                                  fill={proj.color}
                                  fillOpacity="0.75"
                                  rx="1"
                                />
                              )}
                              <text
                                x={labelX}
                                y={labelY}
                                textAnchor="end"
                                fontSize="9"
                                fill="#9ca3af"
                                transform={`rotate(-45,${labelX},${labelY})`}
                              >
                                {bin.label}
                              </text>
                            </g>
                          );
                        });
                      })()}
                    </svg>
                  </div>
                );
              })}
            </div>
          )}
        </TabPanel>
      </Tabs>

      {tooltip && (
        <div
          ref={tooltipRef}
          className="fixed z-50 pointer-events-none bg-white border border-neutral-200 rounded shadow-md text-xs"
          style={{ left: tooltip.clientX + 12, top: tooltip.clientY - 10 }}
        >
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">Key</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">In Progress</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">Done</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">CT</th>
              </tr>
            </thead>
            <tbody>
              {tooltip.items.map((item) => (
                <tr key={item.issueKey} className="border-t border-neutral-50">
                  <td className="px-3 py-1 font-mono whitespace-nowrap">
                    <span className="text-blue-700">{item.issueKey}</span>
                  </td>
                  <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{item.inProgressDateStr}</td>
                  <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{item.doneDateStr}</td>
                  <td className="px-3 py-1 text-gray-800 font-medium whitespace-nowrap">{item.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {histBarTooltip && (
        <div
          ref={histBarTooltipRef}
          className="fixed z-50 pointer-events-none bg-white border border-neutral-200 rounded shadow-md text-xs px-2.5 py-1.5"
          style={{ left: histBarTooltip.clientX + 12, top: histBarTooltip.clientY - 10 }}
        >
          <div className="font-medium text-gray-700">{histBarTooltip.label}</div>
          <div className="text-gray-500">
            {histBarTooltip.count} item{histBarTooltip.count !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      {pinnedTooltip && (
        <div
          ref={pinnedTooltipRef}
          className="fixed z-50 bg-white border border-neutral-200 rounded shadow-md text-xs"
          style={{ left: pinnedTooltip.clientX + 12, top: pinnedTooltip.clientY - 10 }}
        >
          <div className="flex items-center justify-between pl-3 pr-2 py-1.5 border-b border-neutral-100">
            <span className="font-semibold text-gray-700">Issue detail</span>
            <button
              type="button"
              className="text-gray-400 hover:text-gray-600 text-base leading-none ml-4"
              onClick={() => setPinnedTooltip(null)}
            >
              ×
            </button>
          </div>
          <table style={{ borderCollapse: 'collapse' }}>
            <thead>
              <tr className="border-b border-neutral-100">
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">Key</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">In Progress</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">Done</th>
                <th className="px-3 py-1.5 text-left font-semibold text-gray-700 whitespace-nowrap">CT</th>
              </tr>
            </thead>
            <tbody>
              {pinnedTooltip.items.map((item) => (
                <tr key={item.issueKey} className="border-t border-neutral-50">
                  <td className="px-3 py-1 font-mono whitespace-nowrap">
                    {item.url ? (
                      <a href={item.url} target="_blank" rel="noreferrer" className="text-blue-700 hover:underline">
                        {item.issueKey}
                      </a>
                    ) : (
                      <span className="text-blue-700">{item.issueKey}</span>
                    )}
                  </td>
                  <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{item.inProgressDateStr}</td>
                  <td className="px-3 py-1 text-gray-600 whitespace-nowrap">{item.doneDateStr}</td>
                  <td className="px-3 py-1 text-gray-800 font-medium whitespace-nowrap">{item.days}d</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
