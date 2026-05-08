import React, { useState, useMemo, useEffect, useRef } from 'react';
import Button from '@atlaskit/button/new';
import Heading from '@atlaskit/heading';

const DAY_MS = 86_400_000;
const HOUR_MS = 3_600_000;

export interface IssueTypeChartData {
  issueType: string;
  count: number;
  statusColumns: string[];
  allStatusColumns: string[];
  series: Array<{
    projectKey: string;
    count: number;
    points: Array<{
      statusIndex: number;
      statusName: string;
      avgMs: number;
    }>;
  }>;
}

interface TimeInStatusChartsProps {
  issueTypes: IssueTypeChartData[];
  allProjectKeys: string[];
  onHideStatus: (status: string) => void;
  onShowStatus: (status: string) => void;
  customOrders: Record<string, string[]> | undefined;
  onSetCustomOrder: (issueType: string, order: string[] | null) => void;
}

const W = 600;
const PAD_L = 60;
const PAD_R = 20;
const PAD_T = 16;

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

function colorForProject(projectKey: string, allKeys: string[]): string {
  const idx = allKeys.indexOf(projectKey);
  return PROJECT_COLORS[Math.max(0, idx) % PROJECT_COLORS.length];
}

function formatMs(ms: number): string {
  if (ms === 0) return '0';
  if (ms < DAY_MS) return `${Math.round(ms / HOUR_MS)}h`;
  return `${Math.round(ms / DAY_MS)}d`;
}

// Generate Y-axis ticks that land on whole hours (sub-day) or whole days,
// matching the scatter plot's approach of clean round-number intervals.
function niceTimeTicks(maxMs: number): number[] {
  if (maxMs <= 0) return [0, 6 * HOUR_MS, 12 * HOUR_MS, 18 * HOUR_MS, DAY_MS];
  const maxDays = maxMs / DAY_MS;

  if (maxDays < 1) {
    const maxHours = maxMs / HOUR_MS;
    const HOUR_STEPS = [1, 2, 3, 4, 6, 8, 12, 24];
    const rawStep = maxHours / 4;
    const step = HOUR_STEPS.find((s) => s >= rawStep) ?? 24;
    const niceMax = Math.ceil(maxHours / step) * step;
    return Array.from({ length: Math.round(niceMax / step) + 1 }, (_, i) => i * step * HOUR_MS);
  }

  const DAY_STEPS = [1, 2, 5, 7, 10, 14, 21, 30, 60, 90];
  const rawStep = maxDays / 4;
  const step = DAY_STEPS.find((s) => s >= rawStep) ?? Math.ceil(rawStep / 10) * 10;
  const niceMax = Math.ceil(maxDays / step) * step;
  return Array.from({ length: Math.round(niceMax / step) + 1 }, (_, i) => i * step * DAY_MS);
}

interface TooltipState {
  clientX: number;
  clientY: number;
  label: string;
}

const SingleChart: React.FC<{
  data: IssueTypeChartData;
  allProjectKeys: string[];
  onHideStatus: (status: string) => void;
  onShowStatus: (status: string) => void;
  customOrder: string[] | null;
  onSetCustomOrder: (order: string[] | null) => void;
}> = ({ data, allProjectKeys, onHideStatus, onShowStatus, customOrder, onSetCustomOrder }) => {
  const statusColumns = data.statusColumns;
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);
  const [dragStatus, setDragStatus] = useState<string | null>(null);
  const [dragFromSection, setDragFromSection] = useState<'visible' | 'hidden' | null>(null);
  const reorderRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!reorderOpen) return;
    const handler = (e: MouseEvent) => {
      if (reorderRef.current && !reorderRef.current.contains(e.target as Node)) {
        setReorderOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [reorderOpen]);

  const nSeries = data.series.length;
  const multiProject = nSeries > 1;

  const chartStatuses = useMemo(() => {
    const withData = statusColumns.filter((s) =>
      data.series.some((ser) => ser.points.some((pt) => pt.statusName === s)),
    );
    if (!customOrder) return withData;
    const dataSet = new Set(withData);
    const filtered = customOrder.filter((s) => dataSet.has(s));
    const extras = withData.filter((s) => !filtered.includes(s));
    return [...filtered, ...extras];
  }, [statusColumns, customOrder, data.series]);

  const chartStatusSet = useMemo(() => new Set(chartStatuses), [chartStatuses]);

  const localMax = useMemo(
    () =>
      data.series.reduce(
        (max, ser) =>
          ser.points.filter((pt) => chartStatusSet.has(pt.statusName)).reduce((m, pt) => Math.max(m, pt.avgMs), max),
        0,
      ),
    [data.series, chartStatusSet],
  );

  const hiddenStatuses = useMemo(() => {
    const withData = new Set(data.series.flatMap((ser) => ser.points.map((pt) => pt.statusName)));
    return data.allStatusColumns.filter((s) => !statusColumns.includes(s) || !withData.has(s));
  }, [data.allStatusColumns, data.series, statusColumns]);

  const maxLabelLen = chartStatuses.reduce((max, s) => Math.max(max, s.length), 0);
  const padBottom = Math.max(56, Math.min(120, Math.ceil(maxLabelLen * 4.3) + 12));

  // First label extends left when rotated -45°; ensure PAD_L is wide enough to contain it.
  const firstLabelLen = chartStatuses[0]?.length ?? 0;
  const effectivePadL = Math.max(PAD_L, Math.ceil(firstLabelLen * 5.5 * 0.707) + 4);

  const H = PAD_T + 140 + padBottom;
  const PH = H - PAD_T - padBottom;
  const PW = W - effectivePadL - PAD_R;
  const n = chartStatuses.length;

  const xOf = (statusName: string) => {
    const idx = chartStatuses.indexOf(statusName);
    return n <= 1 ? effectivePadL + PW / 2 : effectivePadL + (idx / (n - 1)) * PW;
  };
  const yOf = (ms: number) => PAD_T + PH - (yMaxMs > 0 ? (ms / yMaxMs) * PH : 0);

  const baseline = PAD_T + PH;

  const stdTicks = niceTimeTicks(localMax * 1.1);
  const yMaxMs = stdTicks[stdTicks.length - 1] || 1;

  const handleEnter = (e: React.MouseEvent, projectKey: string, pt: { statusName: string; avgMs: number }) => {
    const label = multiProject
      ? `[${projectKey}] ${pt.statusName}: ${formatMs(pt.avgMs)}`
      : `${pt.statusName}: ${formatMs(pt.avgMs)}`;
    setTooltip({ clientX: e.clientX, clientY: e.clientY, label });
  };

  const handleMove = (e: React.MouseEvent) =>
    setTooltip((prev) => (prev ? { ...prev, clientX: e.clientX, clientY: e.clientY } : prev));

  const clearDrag = () => {
    setDragStatus(null);
    setDragFromSection(null);
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-5" style={{ maxWidth: '900px' }}>
      <div className="flex items-center gap-3 mb-2">
        <Heading size="small">
          {data.issueType} <span className="text-neutral-400 font-normal text-sm">({data.count})</span>
        </Heading>
        <div className="relative" ref={reorderRef}>
          <Button appearance="default" spacing="compact" onClick={() => setReorderOpen((o) => !o)}>
            Reorder Statuses ▾
          </Button>
          {reorderOpen && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-neutral-200 rounded shadow-md z-20 py-1 min-w-[200px]">
              {/* Visible statuses */}
              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFromSection === 'hidden' && dragStatus) {
                    onShowStatus(dragStatus);
                  }
                }}
              >
                {chartStatuses.map((status, i) => (
                  <div
                    key={status}
                    draggable
                    onDragStart={() => {
                      setDragStatus(status);
                      setDragFromSection('visible');
                    }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      if (!dragStatus || dragStatus === status || dragFromSection !== 'visible') return;
                      const newOrder = [...chartStatuses];
                      const fromIdx = newOrder.indexOf(dragStatus);
                      if (fromIdx === -1 || fromIdx === i) return;
                      newOrder.splice(fromIdx, 1);
                      newOrder.splice(i, 0, dragStatus);
                      onSetCustomOrder(newOrder);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      if (dragFromSection === 'hidden' && dragStatus) {
                        onShowStatus(dragStatus);
                        const newOrder = [...chartStatuses];
                        newOrder.splice(i, 0, dragStatus);
                        onSetCustomOrder(newOrder);
                      }
                    }}
                    onDragEnd={clearDrag}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm select-none hover:bg-neutral-50 ${dragStatus === status ? 'opacity-40' : ''}`}
                    style={{ cursor: 'grab' }}
                  >
                    <span className="text-neutral-300 flex-shrink-0" style={{ fontSize: '14px', lineHeight: 1 }}>
                      ⠿
                    </span>
                    <span className="flex-grow">{status}</span>
                  </div>
                ))}
              </div>

              {/* Divider + hidden section */}
              <div className="border-t border-neutral-200 mx-2 my-1" />
              <div className="px-3 py-0.5 text-xs text-neutral-400 font-medium uppercase tracking-wide">Hidden</div>
              <div
                className={`min-h-[32px] ${dragFromSection === 'visible' ? 'bg-neutral-50' : ''}`}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragFromSection === 'visible' && dragStatus) {
                    onHideStatus(dragStatus);
                  }
                }}
              >
                {hiddenStatuses.map((status) => (
                  <div
                    key={status}
                    draggable
                    onDragStart={() => {
                      setDragStatus(status);
                      setDragFromSection('hidden');
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDragEnd={clearDrag}
                    className={`flex items-center gap-2 px-3 py-1.5 text-sm select-none hover:bg-neutral-50 text-neutral-400 ${dragStatus === status ? 'opacity-40' : ''}`}
                    style={{ cursor: 'grab' }}
                  >
                    <span className="text-neutral-300 flex-shrink-0" style={{ fontSize: '14px', lineHeight: 1 }}>
                      ⠿
                    </span>
                    <span className="flex-grow">{status}</span>
                  </div>
                ))}
                {hiddenStatuses.length === 0 && (
                  <div className="px-3 py-2 text-xs text-neutral-300 italic">Drag statuses here to hide</div>
                )}
              </div>

              {customOrder && (
                <div className="border-t border-neutral-100 mt-1 pt-1 px-2">
                  <Button appearance="subtle" spacing="compact" onClick={() => onSetCustomOrder(null)}>
                    Reset to default
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <svg
        width="100%"
        viewBox={`0 0 ${W} ${H}`}
        style={{ display: 'block', overflow: 'visible' }}
        onMouseLeave={() => setTooltip(null)}
      >
        {/* ── Y gridlines + labels ── */}
        {stdTicks.map((tick) => {
          const y = yOf(tick);
          return (
            <g key={tick}>
              <line x1={effectivePadL} y1={y} x2={effectivePadL + PW} y2={y} stroke="#f3f4f6" strokeWidth="1" />
              <text x={effectivePadL - 6} y={y + 4} textAnchor="end" fontSize="10" fill="#9ca3af">
                {formatMs(tick)}
              </text>
            </g>
          );
        })}

        {/* ── Axes ── */}
        <line x1={effectivePadL} y1={PAD_T} x2={effectivePadL} y2={baseline} stroke="#e5e7eb" strokeWidth="1" />
        <line x1={effectivePadL} y1={baseline} x2={effectivePadL + PW} y2={baseline} stroke="#e5e7eb" strokeWidth="1" />

        {/* ── X tick marks + rotated labels ── */}
        {chartStatuses.map((status) => {
          const x = xOf(status);
          return (
            <g key={status}>
              <line x1={x} y1={baseline} x2={x} y2={baseline + 4} stroke="#e5e7eb" strokeWidth="1" />
              <text
                x={x}
                y={baseline + 8}
                textAnchor="end"
                fontSize="10"
                fill="#6b7280"
                transform={`rotate(-45, ${x}, ${baseline + 8})`}
              >
                {status}
              </text>
            </g>
          );
        })}

        {/* ── Line chart ── */}
        {data.series.map((ser) => {
          const color = colorForProject(ser.projectKey, allProjectKeys);
          const chartStatusSet = new Set(chartStatuses);
          const pointsInOrder = [...ser.points]
            .filter((pt) => chartStatusSet.has(pt.statusName))
            .sort((a, b) => chartStatuses.indexOf(a.statusName) - chartStatuses.indexOf(b.statusName));
          const linePath = pointsInOrder
            .map((pt, i) => `${i === 0 ? 'M' : 'L'} ${xOf(pt.statusName)} ${yOf(pt.avgMs)}`)
            .join(' ');
          return (
            <g key={ser.projectKey}>
              <path d={linePath} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
              {pointsInOrder.map((pt) => (
                <circle
                  key={pt.statusName}
                  cx={xOf(pt.statusName)}
                  cy={yOf(pt.avgMs)}
                  r="4"
                  fill="white"
                  stroke={color}
                  strokeWidth="2"
                  style={{ cursor: 'default' }}
                  onMouseEnter={(e) => handleEnter(e, ser.projectKey, pt)}
                  onMouseMove={handleMove}
                />
              ))}
            </g>
          );
        })}
      </svg>

      {/* ── Legend (multi-project only) ── */}
      {multiProject && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
          {data.series.map((ser) => (
            <div key={ser.projectKey} className="flex items-center gap-1.5 text-xs text-gray-600">
              <span
                style={{ backgroundColor: colorForProject(ser.projectKey, allProjectKeys) }}
                className="inline-block w-2.5 h-2.5 rounded-full flex-shrink-0"
              />
              {ser.projectKey}
              <span className="text-gray-400">({ser.count})</span>
            </div>
          ))}
        </div>
      )}

      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none bg-white border border-neutral-200 rounded shadow-sm text-xs px-2 py-1 whitespace-nowrap"
          style={{ left: tooltip.clientX + 12, top: tooltip.clientY - 28 }}
        >
          {tooltip.label}
        </div>
      )}
    </div>
  );
};

export const TimeInStatusCharts: React.FC<TimeInStatusChartsProps> = ({
  issueTypes,
  allProjectKeys,
  onHideStatus,
  onShowStatus,
  customOrders,
  onSetCustomOrder,
}) => {
  if (!issueTypes.length) return null;

  return (
    <div className="flex flex-col gap-y-8">
      {issueTypes.map((data) => (
        <SingleChart
          key={data.issueType}
          data={data}
          allProjectKeys={allProjectKeys}
          onHideStatus={onHideStatus}
          onShowStatus={onShowStatus}
          customOrder={customOrders?.[data.issueType] ?? null}
          onSetCustomOrder={(order) => onSetCustomOrder(data.issueType, order)}
        />
      ))}
    </div>
  );
};
