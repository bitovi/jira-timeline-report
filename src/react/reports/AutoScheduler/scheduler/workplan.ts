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

class ScheduledWorkNode {
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

class WorkPlan {
  head: ScheduledWorkNode | null = null;
  tail: ScheduledWorkNode | null = null;

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

  sheduleWork(work: WorkItem, firstDayWorkCouldStartOn: number): void {
    for (const workPlan of this.plans) {
      if (workPlan.isEmpty) {
        workPlan.append(work, firstDayWorkCouldStartOn);
        return;
      }
    }

    const earliest = this.plans
      .map((plan) => plan.earliestStartDay(work, firstDayWorkCouldStartOn))
      .sort((a, b) => a.possibleStartDay - b.possibleStartDay);

    earliest[0].updatePlan();
  }
}
