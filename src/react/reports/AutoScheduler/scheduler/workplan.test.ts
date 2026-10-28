import { describe, it, expect } from 'vitest';

import { WorkPlans, type WorkItem } from './workplan';

const work = (daysOfWork: number): WorkItem => ({ startDay: null, daysOfWork });

const trackOf = (plans: WorkPlans, item: WorkItem) =>
  plans.plans.findIndex((plan) => plan.work.includes(item as never));

describe('WorkPlans.reserve', () => {
  it('pins work at its start on the first track with nothing overlapping', () => {
    const plans = new WorkPlans(2);
    const first = work(5);
    const second = work(5);
    const later = work(5);

    plans.reserve(first, 0);
    plans.reserve(second, 2);
    plans.reserve(later, 5);

    expect([first.startDay, second.startDay, later.startDay]).toEqual([0, 2, 5]);
    expect([trackOf(plans, first), trackOf(plans, second), trackOf(plans, later)]).toEqual([0, 1, 0]);
  });

  it('adds an overflow track when more reservations overlap than there are tracks', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(10), 0);
    const overflowing = work(10);
    plans.reserve(overflowing, 5);

    expect(plans.plans).toHaveLength(2);
    expect(plans.plans[1].overflow).toBe(true);
    expect(trackOf(plans, overflowing)).toBe(1);
  });

  it('keeps a track sorted when a reservation lands before existing work', () => {
    const plans = new WorkPlans(1);
    const late = work(5);
    const early = work(5);
    plans.reserve(late, 10);
    plans.reserve(early, 0);

    expect(plans.plans[0].work.map((item) => item.startDay)).toEqual([0, 10]);
  });
});

describe('WorkPlans.sheduleWork around reservations', () => {
  it('never schedules onto an overflow track', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(10), 0);
    plans.reserve(work(10), 0); // overflow track 1, busy 0–10
    const unfrozen = work(3);
    plans.sheduleWork(unfrozen, 0);

    expect(trackOf(plans, unfrozen)).toBe(0);
    expect(unfrozen.startDay).toBe(10);
  });

  it('fits unfrozen work into the gap before a reservation when it fits', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(5), 5);
    const fits = work(3);
    plans.sheduleWork(fits, 0);

    expect(fits.startDay).toBe(0);
  });

  it('puts unfrozen work after a reservation when the gap is too small', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(5), 5);
    const tooBig = work(6);
    plans.sheduleWork(tooBig, 0);

    expect(tooBig.startDay).toBe(10);
  });
});

describe('WorkPlans.scheduleWorkBackward', () => {
  it('ends work at its deadline on a free track', () => {
    const plans = new WorkPlans(1);
    const item = work(3);
    plans.scheduleWorkBackward(item, 10);

    expect(item.startDay).toBe(7);
  });

  it('goes earlier past busy time, even before day 0', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(10), 0);
    const item = work(4);
    plans.scheduleWorkBackward(item, 8);

    expect(item.startDay).toBe(-4);
  });

  it('fits a gap between two items when the deadline falls inside it', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(2), 0);
    plans.reserve(work(2), 8);
    const item = work(3);
    plans.scheduleWorkBackward(item, 9);

    expect(item.startDay).toBe(5);
    expect(plans.plans[0].work.map((w) => w.startDay)).toEqual([0, 5, 8]);
  });

  it('picks the track that allows the latest start, and never an over-capacity one', () => {
    const plans = new WorkPlans(2);
    plans.reserve(work(10), 0);
    plans.reserve(work(10), 0);
    plans.reserve(work(10), 0); // over capacity
    const item = work(2);
    plans.scheduleWorkBackward(item, 5);

    expect(item.startDay).toBe(-2);
    expect(trackOf(plans, item)).toBeLessThan(2);
  });
});

describe('WorkPlans.scheduleWorkWithDeadline', () => {
  it('uses the normal slot when it meets the deadline', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(5), 5);
    const item = work(3);
    plans.scheduleWorkWithDeadline(item, 0, 5);

    expect(item.startDay).toBe(0);
    expect(trackOf(plans, item)).toBe(0);
  });

  it('starts late deadline work on time on an over-capacity track instead of queuing it', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(5), 5);
    const item = work(8);
    plans.scheduleWorkWithDeadline(item, 0, 5);

    expect(item.startDay).toBe(0);
    expect(trackOf(plans, item)).toBe(1);
    expect(plans.plans[1].overflow).toBe(true);
  });

  it('waits normally when the delay still meets the deadline', () => {
    const plans = new WorkPlans(1);
    plans.reserve(work(2), 0);
    const item = work(3);
    plans.scheduleWorkWithDeadline(item, 0, 10);

    expect(item.startDay).toBe(2);
    expect(trackOf(plans, item)).toBe(0);
  });
});
