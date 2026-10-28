import type { SimulationIssueResult } from './scheduler/stats-analyzer';
import type { GridUIData } from './AutoScheduler';

import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { IssueSimulationRow } from './IssueSimulationRow';

// Monday. Jira dates are local midnights.
const PLAN_START = new Date(Date.UTC(2026, 0, 5));
const GRID = { gridNumberOfDays: 20, gridStartDay: 0 } as GridUIData;

function result({
  frozen = null,
  start,
  due,
  bar = [0, 5],
  isOverflowTrack = false,
  beforeStartPercent = 0,
  ownDue,
  ownWindow,
  mightStart,
}: {
  frozen?: { startDay: number | null; dueDay: number | null } | null;
  start?: Date;
  due?: Date;
  bar?: [number, number];
  isOverflowTrack?: boolean;
  beforeStartPercent?: number;
  ownDue?: number;
  ownWindow?: [number, number];
  mightStart?: number;
}) {
  return {
    linkedIssue: {
      key: 'ORDER-1',
      summary: 'Checkout',
      url: '#ORDER-1',
      frozen,
      linkedBlocks: [],
      team: { name: 'ORDER', parallelWorkLimit: 1 },
      derivedTiming: {
        start,
        due,
        isConfidenceValid: true,
        isStoryPointsValid: true,
        isStoryPointsMedianValid: true,
      },
    },
    startDayBottom: mightStart ?? bar[0],
    startDateWithTimeEnoughToFinish: bar[0],
    dueDayBottom: bar[1],
    dueDayTop: bar[1],
    ownDueDayTop: ownDue ?? bar[1],
    ownWindowStart: (ownWindow ?? bar)[0],
    ownWindowEnd: (ownWindow ?? bar)[1],
    track: 0,
    adjustedDaysOfWork: bar[1] - bar[0],
    isOverflowTrack,
    lateForFrozenPercent: 0,
    beforeStartPercent,
  } as unknown as SimulationIssueResult;
}

const renderRow = (
  issue: SimulationIssueResult,
  props: { isFrozen?: boolean; uncertaintyWeight?: number | 'average' } = {},
  gridData = GRID,
) =>
  render(
    <div>
      <IssueSimulationRow
        issue={issue}
        gridRowStart={4}
        gridData={gridData}
        selectedStartDate={PLAN_START}
        uncertaintyWeight="average"
        onToggleFreeze={vi.fn()}
        {...props}
      />
    </div>,
  );

describe('IssueSimulationRow', () => {
  it('shadows the Jira dates when they differ from the bar', () => {
    // Jira: Mon 12th – Fri 16th → days 5–10. Bar: 0–5.
    renderRow(result({ start: new Date(2026, 0, 12), due: new Date(2026, 0, 16) }));

    const shadow = screen.getByTestId('jira-dates-shadow');
    expect(shadow.style.left).toBe('25%');
    expect(shadow.style.width).toBe('25%');
  });

  it('hides the shadow when it lines up with the bar', () => {
    renderRow(result({ start: new Date(2026, 0, 5), due: new Date(2026, 0, 9) }));

    expect(screen.queryByTestId('jira-dates-shadow')).not.toBeInTheDocument();
  });

  it('draws no shadow for an item with only one date', () => {
    renderRow(result({ due: new Date(2026, 0, 16) }));

    expect(screen.queryByTestId('jira-dates-shadow')).not.toBeInTheDocument();
  });

  it('draws a frozen item as a solid, locked bar with no might-start line', () => {
    const { container } = renderRow(
      result({ frozen: { startDay: 0, dueDay: 5 }, start: new Date(2026, 0, 5), due: new Date(2026, 0, 9) }),
      { isFrozen: true },
    );

    const bar = container.querySelector('#ORDER-1')!;
    expect(bar).toHaveAttribute('data-frozen', 'true');
    expect(bar).toHaveClass('bg-blue-500');
    expect(container.querySelector('.h-1.top-2\\.5')).toBeNull();
    expect(screen.getByRole('button', { name: 'Unfreeze Checkout' })).toBeInTheDocument();
  });

  it('keeps the uncertainty gradient on the free side of an item frozen with one date', () => {
    const { container } = renderRow(result({ frozen: { startDay: null, dueDay: 5 }, due: new Date(2026, 0, 9) }), {
      isFrozen: true,
    });

    expect(container.querySelector('#ORDER-1')).toHaveClass('bg-gradient-to-r', 'from-blue-200');
  });

  it('positions bars from the grid start when the grid begins before the start date', () => {
    // Grid runs from day -5 over 20 columns: day -5 is 0%, day 0 is 25%.
    const { container } = renderRow(result({ bar: [-5, 5] }), {}, {
      gridNumberOfDays: 20,
      gridStartDay: -5,
    } as GridUIData);

    const bar = container.querySelector('#ORDER-1') as HTMLElement;
    expect(bar.style.left).toBe('0%');
    expect(bar.style.width).toBe('50%');
  });

  it('draws the whisker over the span the item’s own adjusted size covers', () => {
    renderRow(result({ bar: [0, 5], ownWindow: [3, 12] }));

    const line = screen.getByTestId('issue-range-line');
    expect(line.style.left).toBe('15%');
    expect(line.style.width).toBe('45%');
  });

  it('marks when the item might start with a dot on the same line', () => {
    renderRow(result({ bar: [4, 9], mightStart: 2, ownWindow: [5, 12] }));

    expect(screen.getByTestId('might-start-dot').style.left).toBe('10%');
  });

  it('draws neither whisker nor dot for a frozen item', () => {
    renderRow(result({ frozen: { startDay: 0, dueDay: 5 } }), { isFrozen: true });

    expect(screen.queryByTestId('issue-range-line')).not.toBeInTheDocument();
    expect(screen.queryByTestId('might-start-dot')).not.toBeInTheDocument();
  });

  describe('previewing a freeze from the lock', () => {
    const lock = (name = 'Freeze Checkout') => screen.getByRole('button', { name });

    it('fills in the Jira dates and fades the bar, whisker and dot', async () => {
      const { container } = renderRow(
        result({ start: new Date(2026, 0, 12), due: new Date(2026, 0, 16), ownWindow: [0, 8], mightStart: 0 }),
      );

      await userEvent.hover(lock());

      const shadow = screen.getByTestId('jira-dates-shadow');
      expect(shadow).toHaveAttribute('data-previewing', 'true');
      expect(shadow).not.toHaveClass('blur-xs');
      expect(container.querySelector('#ORDER-1')).toHaveClass('opacity-25');
      expect(screen.getByTestId('issue-range-line')).toHaveClass('opacity-25');
      expect(screen.getByTestId('might-start-dot')).toHaveClass('opacity-25');

      await userEvent.unhover(lock());

      expect(screen.getByTestId('jira-dates-shadow')).not.toHaveAttribute('data-previewing');
      expect(container.querySelector('#ORDER-1')).not.toHaveClass('opacity-25');
    });

    it('previews on keyboard focus too', async () => {
      renderRow(result({ start: new Date(2026, 0, 12), due: new Date(2026, 0, 16) }));

      await userEvent.tab();

      expect(lock()).toHaveFocus();
      expect(screen.getByTestId('jira-dates-shadow')).toHaveAttribute('data-previewing', 'true');
    });

    it('shows the Jira dates even when they line up with the bar', async () => {
      renderRow(result({ start: new Date(2026, 0, 5), due: new Date(2026, 0, 9) }));

      await userEvent.hover(lock());

      const shadow = screen.getByTestId('jira-dates-shadow');
      expect(shadow).toHaveAttribute('data-previewing', 'true');
      expect(shadow.style.left).toBe('0%');
      expect(shadow.style.width).toBe('25%');
    });

    it('marks the one held date, and fades only the whisker, for an item with one date', async () => {
      const { container } = renderRow(result({ due: new Date(2026, 0, 16) }));

      await userEvent.hover(lock());

      expect(screen.queryByTestId('jira-dates-shadow')).not.toBeInTheDocument();
      // Due Fri 16th is exclusive day 10.
      expect(screen.getByTestId('freeze-preview-date').style.left).toBe('50%');
      expect(screen.getByTestId('issue-range-line')).toHaveClass('opacity-25');
      expect(container.querySelector('#ORDER-1')).not.toHaveClass('opacity-25');
    });

    it('dims a frozen bar when previewing an unfreeze', async () => {
      const { container } = renderRow(
        result({ frozen: { startDay: 0, dueDay: 5 }, start: new Date(2026, 0, 5), due: new Date(2026, 0, 9) }),
        { isFrozen: true },
      );

      await userEvent.hover(lock('Unfreeze Checkout'));

      expect(container.querySelector('#ORDER-1')).toHaveClass('opacity-60');
      expect(screen.queryByTestId('jira-dates-shadow')).not.toBeInTheDocument();
    });

    it('previews nothing when the item has no Jira dates to freeze at', async () => {
      const { container } = renderRow(result({}));

      await userEvent.hover(lock());

      expect(screen.queryByTestId('freeze-preview-date')).not.toBeInTheDocument();
      expect(screen.getByTestId('issue-range-line')).not.toHaveClass('opacity-25');
      expect(container.querySelector('#ORDER-1')).not.toHaveClass('opacity-25');
    });
  });

  it('says when the item on its own is done by, at the slider’s risk', async () => {
    // Bar ends day 5 (last day worked: Fri Jan 9); its own finish ends day 9 (last day: Thu Jan 15).
    const { container } = renderRow(result({ bar: [0, 5], ownDue: 9 }), { uncertaintyWeight: 90 });

    await userEvent.hover(container.querySelector('#ORDER-1')!);
    expect((await screen.findAllByText(/Must end:\s*Jan 9, 2026/))[0]).toBeInTheDocument();
    expect(screen.getAllByText('90% chance done by Jan 15, 2026')[0]).toBeInTheDocument();
  });

  it('words the item’s own finish as an average at average', async () => {
    const { container } = renderRow(result({ bar: [0, 5], ownDue: 9 }));

    await userEvent.hover(container.querySelector('#ORDER-1')!);
    expect((await screen.findAllByText('Done by Jan 15, 2026 on average'))[0]).toBeInTheDocument();
  });

  it('says how often a bar that starts before the start date starts early', async () => {
    const { container } = renderRow(result({ bar: [-5, 5], beforeStartPercent: 72 }), {}, {
      gridNumberOfDays: 20,
      gridStartDay: -5,
    } as GridUIData);

    await userEvent.hover(container.querySelector('#ORDER-1')!);
    expect(await screen.findByText('Starts before the start date in 72% of runs')).toBeInTheDocument();
  });

  it('leaves out the early-start share when the bar at this confidence starts on time', async () => {
    const { container } = renderRow(result({ bar: [2, 8], beforeStartPercent: 7 }));

    await userEvent.hover(container.querySelector('#ORDER-1')!);
    expect(await screen.findByText(/Must start:/)).toBeInTheDocument();
    expect(screen.queryByText(/Starts before the start date/)).not.toBeInTheDocument();
  });

  it('borders a bar on an overflow track orange', () => {
    const { container } = renderRow(result({ frozen: { startDay: 0, dueDay: 5 }, isOverflowTrack: true }));

    expect(container.querySelector('#ORDER-1')).toHaveClass('border-yellow-500');
  });
});

describe('IssueSimulationRow overall timing', () => {
  const overall = {
    linkedIssue: { key: '[~DUE DATE~]', summary: 'Overall timing' },
    startDays: [-4, -2, 0, 0, 0],
    dueDays: [14, 15, 16],
    startDayBottom: 0,
    startDateWithTimeEnoughToFinish: 0,
    dueDayBottom: 14,
    dueDayTop: 16,
    adjustedDaysOfWork: 0,
  } as unknown as SimulationIssueResult;
  const grid = { gridNumberOfDays: 20, gridStartDay: -4 } as GridUIData;

  const renderOverall = (planStart: object) =>
    render(
      <div>
        <IssueSimulationRow
          issue={overall}
          gridRowStart={3}
          gridData={grid}
          selectedStartDate={PLAN_START}
          uncertaintyWeight={80}
          planStart={planStart as never}
        />
      </div>,
    );

  it('draws a median finish as a visible pill, though its two ends come from neighbouring runs', () => {
    // At the median the band's ends are adjacent sorted runs: a hair apart, not equal.
    const { container } = render(
      <div>
        <IssueSimulationRow
          issue={{ ...overall, dueDayBottom: 15, dueDayTop: 15.003 } as SimulationIssueResult}
          gridRowStart={3}
          gridData={grid}
          selectedStartDate={PLAN_START}
          uncertaintyWeight={50}
        />
      </div>,
    );

    expect(container.querySelector('[id="[~DUE DATE~]"]')).toHaveClass('border-x-4');
  });

  it('draws a start band and a finish band, with nothing joining them', () => {
    renderOverall({ startDay: -4, startDayLate: 0, beforeStartPercent: 40, startDays: [-4, -2, 0, 0, 0] });

    const band = screen.getByTestId('overall-start-band');
    expect(band.style.left).toBe('0%');
    expect(band.style.width).toBe('20%');
    expect(screen.queryByTestId('overall-span')).not.toBeInTheDocument();
  });

  it('draws both bands at full height, whether they show one date or a range', () => {
    const { container } = renderOverall({ startDay: -4, startDayLate: 0, beforeStartPercent: 40, startDays: [] });

    const start = screen.getByTestId('overall-start-band');
    const finish = container.querySelector('[id="[~DUE DATE~]"]')!;
    for (const band of [start, finish]) {
      expect(band).toHaveClass('h-4', 'border');
      expect(band).not.toHaveClass('border-[6px]');
    }
  });

  it('opens the histograms from anywhere on the row', async () => {
    const { container } = renderOverall({ startDay: -4, startDayLate: 0, beforeStartPercent: 40, startDays: [] });

    await userEvent.click(screen.getByTestId('overall-timing-row'));
    expect(container.querySelectorAll('.bg-blue-100').length).toBeGreaterThan(0);
    expect(container.querySelectorAll('.bg-green-100').length).toBeGreaterThan(0);

    await userEvent.click(screen.getByTestId('overall-timing-row'));
    expect(container.querySelectorAll('.bg-green-100')).toHaveLength(0);
  });

  it('opens the start histogram on click, and says when work has to start, when some runs start early', async () => {
    const { container } = renderOverall({ startDay: -4, startDayLate: 0, beforeStartPercent: 40, startDays: [] });

    await userEvent.hover(screen.getByTestId('overall-start-band'));
    expect(await screen.findByText('work has to start by')).toBeInTheDocument();
    expect(screen.getByText('40% of runs start early')).toBeInTheDocument();

    await userEvent.click(screen.getByTestId('overall-start-band'));
    expect(container.querySelectorAll('.bg-blue-100').length).toBeGreaterThan(0);
  });

  it('shows only the finish histogram when no run starts early', async () => {
    const { container } = renderOverall({ startDay: 0, startDayLate: 0, beforeStartPercent: 0, startDays: [] });

    await userEvent.click(container.querySelector('[id="[~DUE DATE~]"]')!);
    expect(container.querySelectorAll('.bg-blue-100')).toHaveLength(0);
    expect(container.querySelectorAll('.bg-green-100').length).toBeGreaterThan(0);
  });
});
