import type { Report, Reports } from '../../../jira/reports';

import { useState } from 'react';

import { createLegacyReportsBackend, createSpaceReportsBackend } from '../../../jira/reports/backend';
import { useJira } from '../jira';
import { useStorage } from '../storage';

export type MigrationProgress = {
  isMigrating: boolean;
  copied: number;
  total: number;
  /** Report names that could not be copied, so the user can retry or fix them by hand. */
  failures: string[];
};

export type MigrationOutcome = {
  /** Reports copied into the space by this run. */
  copied: number;
  /** How many this run set out to copy — `copied` plus `failures`. */
  total: number;
  /** Reports already in the space, so this run skipped them. */
  alreadyThere: number;
  failures: string[];
};

const idle: MigrationProgress = { isMigrating: false, copied: 0, total: 0, failures: [] };

/**
 * Copies the reports in the legacy record into a Reports Space.
 *
 * **Idempotent by construction.** It lists the space first and copies only the reports whose `id`
 * isn't already there, so re-running after a partial copy repairs it instead of duplicating — which
 * is what makes "just press it again" the right answer to a failure.
 *
 * **The legacy record is never touched.** Not deleted, not rewritten. It stays as a backup, and
 * switching the setting back restores the old behaviour with nothing lost.
 *
 * See spec/026-storage-saved-reports/plan.md § Migration.
 */
export const useMigrateReports = () => {
  const storage = useStorage();
  const jira = useJira();
  const [progress, setProgress] = useState<MigrationProgress>(idle);

  const readLegacyReports = (): Promise<Reports> => createLegacyReportsBackend(storage).readAll();

  const migrate = async ({
    spaceName,
    spaceType,
  }: {
    spaceName: string;
    spaceType: string;
  }): Promise<MigrationOutcome> => {
    const space = createSpaceReportsBackend(jira, { spaceName, spaceType });
    // One listing, whatever the report count: this builds the backend's whole id→work-item map, and
    // the `upsert`s below answer out of it rather than going back to Jira. A migration is therefore
    // one search plus one create per *missing* report — it does not re-read the space per report.
    const [legacyReports, spaceReports] = await Promise.all([readLegacyReports(), space.readAll()]);

    const legacy = Object.values(legacyReports).filter((report): report is Report => !!report);
    // Matched on `report.id`, which round-trips through the JSON payload — not on the summary, which
    // a user can rename.
    const toCopy = legacy.filter((report) => !spaceReports[report.id]);
    const alreadyThere = legacy.length - toCopy.length;

    setProgress({ isMigrating: true, copied: 0, total: toCopy.length, failures: [] });

    const failures: string[] = [];
    let copied = 0;

    // Sequential: this is a burst of work item creates against one space, and Jira's rate limiter is
    // the reason a 40-report migration should take a few seconds rather than fail halfway.
    for (const report of toCopy) {
      try {
        await space.upsert(report, legacyReports);
        copied += 1;
      } catch (error) {
        console.warn(`[reports/storage] could not copy "${report.name}" into ${spaceName}`, error);
        failures.push(report.name);
      }

      setProgress({ isMigrating: true, copied, total: toCopy.length, failures: [...failures] });
    }

    setProgress({ isMigrating: false, copied, total: toCopy.length, failures });

    return { copied, total: toCopy.length, alreadyThere, failures };
  };

  return { migrate, progress, readLegacyReports, resetProgress: () => setProgress(idle) };
};
