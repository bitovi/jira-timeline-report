import { useSuspenseQuery } from '@tanstack/react-query';

import type { Reports } from '../../../jira/reports';
import routeData from '../../../canjs/routing/route-data';
import { reportKeys } from './key-factory';
import { useReportsBackend } from './useReportsBackend';
import { readAllReports } from '../../../jira/reports';
import { persistMigrations } from '../../../jira/reports/migrations/persist';

export type UseAllReports = () => Reports;

export const useAllReports: UseAllReports = () => {
  const backend = useReportsBackend();

  const { data } = useSuspenseQuery({
    queryKey: reportKeys.allReports,
    queryFn: async () => {
      const outcome = await readAllReports(backend);

      // Write-back so stored data converges on the migrated shape, which is what makes deleting a
      // migration at its end of life safe. Fire-and-forget: it writes at most once per session,
      // only when the read above actually migrated something, and never blocks this fetch — the
      // reports returned here are already correct either way. This is the boot path for
      // convergence because it runs wherever the reports UI does; the `?report=` fetch in
      // main-helper.js does not (it is skipped whenever the URL carries no saved report).
      // See spec/018-card-report/saved-report-migrations/plan.md § Wiring.
      void persistMigrations(
        backend,
        outcome,
        // Anonymous sample-data sessions must never write. Read, not subscribed: this is a one-off
        // check inside a fetch, and the observable is absent outside the mounted app (tests), where
        // "not logged in" is the right answer anyway.
        { isLoggedIn: !!(routeData as any).isLoggedInObservable?.value },
      );

      return outcome.reports;
    },
  });

  return data;
};
