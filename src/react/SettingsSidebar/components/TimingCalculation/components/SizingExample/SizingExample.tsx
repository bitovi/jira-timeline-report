import React, { FC, useMemo } from 'react';

import Heading from '@atlaskit/heading';

import {
  buildSizingExample,
  EXAMPLE_DAYS,
  EXAMPLE_ITEMS,
  ExampleRow,
  ExampleSizeFrom,
} from '../../../../../../jira/rollup/work-size/sizing-example';
import type { WorkSettings } from '../../../../../../jira/rollup/work-size/work-settings';

/**
 * "Sizing explanation": a fixed example team sized with the report's Work settings, so people can see what
 * they're configuring. Port of spec/046-rollup-calculation-settings/mockups/sizing-picture.html.
 *
 * Colors use the app's Tailwind scale (tailwind.config.js redefines `neutral-*` / `blue-*`, where
 * lower numbers are lighter): neutral-800 text, neutral-300 / -200 muted, neutral-50 unused values,
 * neutral-40 borders, neutral-20 row lines, neutral-10 the totals row, blue-101 the used size.
 */

const DAY_PX = 40;
const ROW_PX = 32;
const UNIT_PX = 40; // height of one whole day in the per-day row

const NAMES: Record<ExampleSizeFrom, string> = {
  estimate: 'estimate',
  dates: 'date span',
  teamTime: 'team time',
  average: 'level average',
  unsized: 'no size',
};

const fmt = (n: number | null) => (n == null ? '—' : String(Math.round(n * 10) / 10));

const FRACTIONS: Array<[number, string]> = [
  [0.25, '¼'],
  [0.5, '½'],
  [0.75, '¾'],
  [1 / 3, '⅓'],
  [2 / 3, '⅔'],
  [1, '1'],
];
const frac = (n: number) => FRACTIONS.find(([value]) => Math.abs(value - n) < 1e-9)?.[1] ?? fmt(n);

const byKey = Object.fromEntries(EXAMPLE_ITEMS.map((item) => [item.key, item]));

const rowStyle = { height: ROW_PX, lineHeight: `${ROW_PX}px` };
const cell = 'px-1.5 border-b border-neutral-20 whitespace-nowrap overflow-hidden text-ellipsis';
const measure = 'border-l border-neutral-40';
const th = 'text-[11px] font-semibold text-neutral-300 border-b border-neutral-40 px-1.5 pb-1 self-end';
const bottom = 'border-t-2 border-neutral-40 bg-neutral-10 py-1.5';
const total = `${bottom} px-1.5 text-right font-bold tabular-nums flex flex-col justify-end ${measure}`;

/** A measure cell: highlighted when it's the size used, greyed when it isn't. */
const MeasureCell: FC<{ value: number | null; used: boolean; className?: string }> = ({ value, used, className }) => (
  <div
    className={`${cell} text-right tabular-nums ${className ?? ''} ${
      value == null ? 'text-neutral-200' : used ? 'font-bold bg-blue-101 text-neutral-800' : 'text-neutral-50'
    }`}
    style={rowStyle}
  >
    {fmt(value)}
  </div>
);

const SizeTag: FC<{ row: ExampleRow }> = ({ row }) => {
  const tone =
    row.sizeFrom === 'unsized'
      ? 'bg-red-50 text-red-800'
      : row.isFallback
        ? 'bg-yellow-50 text-yellow-800'
        : 'bg-neutral-20 text-neutral-300';
  return (
    <span className={`inline-block text-[10px] leading-4 rounded-full px-1.5 ml-1.5 font-semibold ${tone}`}>
      {NAMES[row.sizeFrom]}
      {row.isFallback && row.sizeFrom !== 'unsized' ? ' ↩' : ''}
    </span>
  );
};

export const SizingExample: FC<{ settings: WorkSettings }> = ({ settings }) => {
  const example = useMemo(() => buildSizingExample(settings), [settings]);

  return (
    <section
      data-testid="sizing-example"
      className="bg-white border border-neutral-40 rounded-lg px-4 py-3.5 text-neutral-800"
    >
      <Heading size="small">Sizing explanation</Heading>
      <p className="text-xs text-neutral-200 pt-1 pb-2.5">
        Five epics of one team, sized in days. Striped bars have dates but no estimate. The bottom row shows where each
        day of the team's time goes; the columns on the right show each epic's size by every method, with the one your
        settings use highlighted.
      </p>

      <div className="overflow-x-auto">
        <div
          className="grid text-xs"
          style={{ gridTemplateColumns: `76px 64px repeat(${EXAMPLE_DAYS}, ${DAY_PX}px) 76px 140px` }}
        >
          {/* what the day numbers are */}
          <div className="col-span-2" />
          <div
            data-testid="days-axis-label"
            className="text-[10px] font-semibold text-neutral-300 text-center pb-0.5"
            style={{ gridColumn: `span ${EXAMPLE_DAYS}` }}
          >
            Business days · each bar runs from start date to due date
          </div>
          <div className="col-span-2" />

          {/* header */}
          <div className={th}>Epic</div>
          <div className={`${th} text-right`}>Estimate</div>
          {example.days.map(({ day }) => (
            <div
              key={day}
              className={`text-[10px] text-neutral-200 text-center border-b border-neutral-40 pb-1 self-end ${
                day % 5 === 1 ? 'border-l' : ''
              }`}
            >
              {day}
            </div>
          ))}
          <div className={`${th} text-right ${measure}`}>Team time</div>
          <div className={`${th} text-right ${measure}`}>Size used</div>

          {/* one row per item */}
          {example.rows.map((row) => {
            const { item } = row;
            const isDated = item.start != null && item.end != null;
            return (
              <React.Fragment key={item.key}>
                <div className={cell} style={rowStyle}>
                  <span
                    className="inline-block w-2.5 h-2.5 rounded-sm mr-1.5 align-[-1px]"
                    style={{ background: item.color }}
                  />
                  {item.name}
                </div>
                <MeasureCell value={item.estimate} used={row.sizeFrom === 'estimate'} />
                <div
                  className="grid items-center border-b border-neutral-20"
                  style={{
                    gridColumn: `span ${EXAMPLE_DAYS}`,
                    gridTemplateColumns: `repeat(${EXAMPLE_DAYS}, ${DAY_PX}px)`,
                    height: ROW_PX,
                  }}
                >
                  {isDated ? (
                    <div
                      data-testid={`bar-${item.key}`}
                      className={`h-[18px] rounded text-white text-[10px] font-semibold px-1.5 leading-[18px] whitespace-nowrap overflow-hidden ${
                        row.sizeFrom === 'dates' ? 'outline outline-2 outline-offset-1 outline-neutral-800' : ''
                      }`}
                      style={{
                        gridColumn: `${item.start} / ${item.end! + 1}`,
                        backgroundColor: item.color,
                        backgroundImage:
                          item.estimate == null
                            ? 'repeating-linear-gradient(45deg, rgba(255,255,255,0.35) 0 4px, transparent 4px 8px)'
                            : undefined,
                        opacity: row.leftOut ? 0.35 : 1,
                      }}
                    >
                      {row.spanDays} days
                      {row.leftOut ? ' · left out' : ''}
                    </div>
                  ) : (
                    <div className="col-span-full text-[11px] text-neutral-200 italic pl-1">
                      No dates{item.estimate != null ? '' : ', no estimate'}
                    </div>
                  )}
                </div>
                <MeasureCell value={row.teamTimeDays} used={row.sizeFrom === 'teamTime'} className={measure} />
                <div
                  className={`${cell} ${measure} text-right tabular-nums`}
                  style={rowStyle}
                  data-testid={`size-${item.key}`}
                >
                  {row.size == null ? '—' : <b>{fmt(row.size)}d</b>}
                  <SizeTag row={row} />
                </div>
              </React.Fragment>
            );
          })}

          {/* bottom row: where each day of team time goes */}
          <div className={`${bottom} col-span-2 px-1.5 text-xs font-bold`}>Team time per day</div>
          {example.days.map(({ day, shares }) => (
            <div key={day} className={`${bottom} flex items-end`}>
              <div
                className={`flex flex-col-reverse w-full border-l border-white ${
                  shares.length
                    ? ''
                    : 'bg-[repeating-linear-gradient(45deg,theme(colors.neutral.20)_0_4px,theme(colors.white)_4px_8px)]'
                }`}
                style={{ height: UNIT_PX }}
                title={shares.map((s) => `${byKey[s.key].name}: ${frac(s.amount)}`).join(', ') || 'idle'}
              >
                {shares.map((share) => (
                  <div
                    key={share.key}
                    className="w-full"
                    style={{ height: share.amount * UNIT_PX, background: byKey[share.key].color }}
                  />
                ))}
              </div>
            </div>
          ))}
          <div className={total}>{fmt(example.totalTeamTime)}</div>
          <div className={total}>{fmt(example.totalSize)}d</div>
        </div>
      </div>
    </section>
  );
};

export default SizingExample;
