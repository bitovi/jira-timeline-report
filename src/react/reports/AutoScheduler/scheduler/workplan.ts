// TypeScript version of WorkPlans and supporting classes

export interface WorkItem {
  startDay: number | null;
  daysOfWork: number;
  artificiallyDelayed?: boolean;
  track?: number;
}

export interface ScheduledWorkItem {
  startDay: number;
  daysOfWork: number;
  artificiallyDelayed?: boolean;
  track?: number;
}

export class ScheduledWorkNode {
  work: ScheduledWorkItem;
  next: ScheduledWorkNode | null = null;
  previous: ScheduledWorkNode | null = null;
  workPlan: WorkPlan;

  constructor(work: ScheduledWorkItem, workPlan: WorkPlan) {
    this.work = work;
    this.workPlan = workPlan;
  }

  isPrependPossible(
    work: WorkItem,
    firstDayWorkCouldStartOn: number,
  ): { isPossible: boolean; possibleStartDay: number } {
    let firstDayToStartWorkAfterExistingWork = 0;
    if (this.previous !== null) {
      firstDayToStartWorkAfterExistingWork = this.previous.work.startDay + this.previous.work.daysOfWork;
    }
    const possibleStartDay = Math.max(firstDayWorkCouldStartOn, firstDayToStartWorkAfterExistingWork);
    return {
      isPossible: possibleStartDay + work.daysOfWork <= this.work.startDay,
      possibleStartDay,
    };
  }

  prependIfPossible(work: WorkItem, firstDayWorkCouldStartOn: number): boolean {
    const { isPossible, possibleStartDay } = this.isPrependPossible(work, firstDayWorkCouldStartOn);
    if (isPossible) {
      this.workPlan.prepend(this, work, possibleStartDay, firstDayWorkCouldStartOn);
      return true;
    }
    return false;
  }

  get isTail(): boolean {
    return this.next === null;
  }

  append(work: ScheduledWorkItem, firstDayWorkCouldStartOn: number): void {
    this.workPlan.append(work, firstDayWorkCouldStartOn);
  }
}

export class WorkPlan {
  head: ScheduledWorkNode | null = null;
  tail: ScheduledWorkNode | null = null;
  /**
   * An over-capacity track: it exists only because more frozen items overlap than the team has
   * tracks. Unfrozen work is never scheduled onto it.
   */
  readonly overflow: boolean;

  constructor({ overflow = false }: { overflow?: boolean } = {}) {
    this.overflow = overflow;
  }

  get isEmpty(): boolean {
    return this.head === null;
  }

  get work(): ScheduledWorkItem[] {
    return [...this].map((node) => node.work);
  }

  earliestStartDay(
    work: WorkItem,
    firstDayWorkCouldStartOn: number,
  ): { possibleStartDay: number; updatePlan: () => void } {
    for (const workNode of this) {
      const { isPossible, possibleStartDay } = workNode.isPrependPossible(work, firstDayWorkCouldStartOn);
      if (isPossible) {
        return {
          possibleStartDay,
          updatePlan: () => {
            workNode.prependIfPossible(work, firstDayWorkCouldStartOn);
          },
        };
      }
    }
    return {
      possibleStartDay: this.appendStartDay(work, firstDayWorkCouldStartOn),
      updatePlan: () => {
        this.append(work, firstDayWorkCouldStartOn);
      },
    };
  }

  prepend(workNode: ScheduledWorkNode, work: WorkItem, startDay: number, firstDayWorkCouldStartOn: number): void {
    work.startDay = startDay;
    const scheduledWorkItem = work as ScheduledWorkItem;
    if (scheduledWorkItem.startDay > firstDayWorkCouldStartOn) {
      scheduledWorkItem.artificiallyDelayed = true;
    }

    const newNode = new ScheduledWorkNode(scheduledWorkItem, this);
    if (this.head === workNode) {
      this.head = newNode;
    } else {
      const oldPrevious = workNode.previous!;
      oldPrevious.next = newNode;
      newNode.previous = oldPrevious;
    }
    newNode.next = workNode;
    workNode.previous = newNode;
  }

  appendStartDay(work: WorkItem, firstDayWorkCouldStartOn: number): number {
    return this.tail
      ? Math.max(this.tail.work.startDay + this.tail.work.daysOfWork, firstDayWorkCouldStartOn)
      : firstDayWorkCouldStartOn;
  }

  append(work: WorkItem, firstDayWorkCouldStartOn: number): void {
    const startDay = this.appendStartDay(work, firstDayWorkCouldStartOn);
    work.startDay = startDay;
    const scheduledWorkItem = work as ScheduledWorkItem;
    if (scheduledWorkItem.startDay > firstDayWorkCouldStartOn) {
      scheduledWorkItem.artificiallyDelayed = true;
    }

    const newNode = new ScheduledWorkNode(scheduledWorkItem, this);
    if (!this.tail) {
      this.head = this.tail = newNode;
    } else {
      const oldTail = this.tail;
      oldTail.next = newNode;
      newNode.previous = oldTail;
      this.tail = newNode;
    }
  }

  /**
   * The latest start for `work` that ends by `latestFinish` without overlapping anything on this
   * plan — the mirror of `earliestStartDay`. Always defined: there is room before the head.
   */
  latestStartDay(work: WorkItem, latestFinish: number): number {
    let nextStart = Number.POSITIVE_INFINITY;
    for (let node = this.tail; node; node = node.previous) {
      const gapStart = node.work.startDay + node.work.daysOfWork;
      const candidate = Math.min(latestFinish, nextStart) - work.daysOfWork;
      if (candidate >= gapStart) return candidate;
      nextStart = node.work.startDay;
    }
    return Math.min(latestFinish, nextStart) - work.daysOfWork;
  }

  /** True when no work on this plan overlaps `[startDay, startDay + daysOfWork)`. */
  isFree(startDay: number, daysOfWork: number): boolean {
    const endDay = startDay + daysOfWork;
    for (const node of this) {
      const nodeEnd = node.work.startDay + node.work.daysOfWork;
      if (node.work.startDay < endDay && startDay < nodeEnd) return false;
    }
    return true;
  }

  /** Places `work` at exactly `startDay`, keeping the list sorted by start. The caller checks `isFree`. */
  insertAt(work: WorkItem, startDay: number): void {
    work.startDay = startDay;
    const scheduledWorkItem = work as ScheduledWorkItem;
    for (const node of this) {
      if (node.work.startDay >= startDay) {
        const newNode = new ScheduledWorkNode(scheduledWorkItem, this);
        if (node.previous) {
          node.previous.next = newNode;
          newNode.previous = node.previous;
        } else {
          this.head = newNode;
        }
        newNode.next = node;
        node.previous = newNode;
        return;
      }
    }
    this.append(work, startDay);
  }

  *[Symbol.iterator](): Generator<ScheduledWorkNode> {
    let node = this.head;
    while (node) {
      yield node;
      node = node.next;
    }
  }
}

export class WorkPlans {
  static sortByEndDate = (a: ScheduledWorkItem, b: ScheduledWorkItem): number => {
    return a.startDay + a.daysOfWork - (b.startDay + b.daysOfWork);
  };

  plans: WorkPlan[] = [];

  constructor(parallelWorkStreams: number) {
    for (let i = 0; i < parallelWorkStreams; i++) {
      this.plans.push(new WorkPlan());
    }
  }

  workNodes(): ScheduledWorkNode[] {
    return this.plans.flatMap((plan) => [...plan]);
  }

  sortedWorkNodes(): ScheduledWorkNode[] {
    return this.workNodes().sort((a, b) => a.work.startDay - b.work.startDay);
  }

  sortedWorkNodesByEndDate(): ScheduledWorkNode[] {
    return this.workNodes().sort((a, b) => WorkPlans.sortByEndDate(a.work, b.work));
  }

  /**
   * Pins `work` at `startDay` on the first track with nothing overlapping its span, adding an
   * overflow track when every track is taken. Used for frozen items, before anything else is placed.
   */
  reserve(work: WorkItem, startDay: number): void {
    for (const plan of this.plans) {
      if (plan.isFree(startDay, work.daysOfWork)) {
        plan.insertAt(work, startDay);
        return;
      }
    }
    this.addOverflowPlan().insertAt(work, startDay);
  }

  /**
   * Places `work` as late as possible so it ends by `latestFinish`, on whichever real track allows
   * the latest start. Used for work upstream of frozen items; never late, and never over capacity,
   * because it can always go earlier.
   */
  scheduleWorkBackward(work: WorkItem, latestFinish: number): void {
    let best: WorkPlan | null = null;
    let bestStart = Number.NEGATIVE_INFINITY;
    for (const plan of this.plans) {
      if (plan.overflow) continue;
      const start = plan.latestStartDay(work, latestFinish);
      if (start > bestStart) {
        best = plan;
        bestStart = start;
      }
    }
    best!.insertAt(work, bestStart);
  }

  /**
   * `sheduleWork` for work that must finish by `latestFinish`. When the only room on the real tracks
   * would both delay it and make it late, it starts on time on an over-capacity track instead — work
   * with a deadline is never queued behind the frozen item it has to finish before.
   */
  scheduleWorkWithDeadline(work: WorkItem, firstDayWorkCouldStartOn: number, latestFinish: number): void {
    const realPlans = this.plans.filter((plan) => !plan.overflow);
    if (realPlans.some((plan) => plan.isEmpty)) {
      this.sheduleWork(work, firstDayWorkCouldStartOn);
      return;
    }
    const best = realPlans
      .map((plan) => plan.earliestStartDay(work, firstDayWorkCouldStartOn))
      .sort((a, b) => a.possibleStartDay - b.possibleStartDay)[0];
    const delayed = best.possibleStartDay > firstDayWorkCouldStartOn;
    if (!delayed || best.possibleStartDay + work.daysOfWork <= latestFinish) {
      best.updatePlan();
      return;
    }
    const overflowPlan =
      this.plans.find((plan) => plan.overflow && plan.isFree(firstDayWorkCouldStartOn, work.daysOfWork)) ??
      this.addOverflowPlan();
    overflowPlan.insertAt(work, firstDayWorkCouldStartOn);
  }

  private addOverflowPlan(): WorkPlan {
    const plan = new WorkPlan({ overflow: true });
    this.plans.push(plan);
    return plan;
  }

  sheduleWork(work: WorkItem, firstDayWorkCouldStartOn: number): void {
    for (const workPlan of this.plans) {
      if (workPlan.isEmpty && !workPlan.overflow) {
        workPlan.append(work, firstDayWorkCouldStartOn);
        return;
      }
    }

    const earliest = this.plans
      .filter((plan) => !plan.overflow)
      .map((plan) => plan.earliestStartDay(work, firstDayWorkCouldStartOn))
      .sort((a, b) => a.possibleStartDay - b.possibleStartDay);

    earliest[0].updatePlan();
  }
}
