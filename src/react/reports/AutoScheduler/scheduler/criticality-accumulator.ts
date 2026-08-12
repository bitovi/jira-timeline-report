import type { Hop } from './critical-path-trace';

/**
 * Turns a stream of per-iteration `traceDrivingChain` results into, per issue: the fraction of
 * iterations it appeared on the traced driving chain (its criticality index), and its mean work/queued
 * days across only the iterations it was on the chain. See spec/024-critical-path/README.md, "Three
 * definitions the implementation must not drift from".
 */
export class CriticalityAccumulator {
  iterations = 0;
  private onChainCount = new Map<string, number>();
  private workDaysSum = new Map<string, number>();
  private queuedDaysSum = new Map<string, number>();

  addIteration(hops: Hop[]): void {
    this.iterations++;
    for (const hop of hops) {
      this.onChainCount.set(hop.issueKey, (this.onChainCount.get(hop.issueKey) ?? 0) + 1);
      this.workDaysSum.set(hop.issueKey, (this.workDaysSum.get(hop.issueKey) ?? 0) + hop.workDays);
      this.queuedDaysSum.set(hop.issueKey, (this.queuedDaysSum.get(hop.issueKey) ?? 0) + hop.queuedDays);
    }
  }

  merge(other: CriticalityAccumulator): void {
    this.iterations += other.iterations;
    for (const [key, count] of other.onChainCount) {
      this.onChainCount.set(key, (this.onChainCount.get(key) ?? 0) + count);
    }
    for (const [key, sum] of other.workDaysSum) {
      this.workDaysSum.set(key, (this.workDaysSum.get(key) ?? 0) + sum);
    }
    for (const [key, sum] of other.queuedDaysSum) {
      this.queuedDaysSum.set(key, (this.queuedDaysSum.get(key) ?? 0) + sum);
    }
  }

  criticalityIndex(issueKey: string): number {
    if (this.iterations === 0) return 0;
    return (this.onChainCount.get(issueKey) ?? 0) / this.iterations;
  }

  meanWorkDays(issueKey: string): number {
    const onChain = this.onChainCount.get(issueKey) ?? 0;
    if (onChain === 0) return 0;
    return (this.workDaysSum.get(issueKey) ?? 0) / onChain;
  }

  meanQueuedDays(issueKey: string): number {
    const onChain = this.onChainCount.get(issueKey) ?? 0;
    if (onChain === 0) return 0;
    return (this.queuedDaysSum.get(issueKey) ?? 0) / onChain;
  }
}
