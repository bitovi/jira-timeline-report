import type { FC } from 'react';
import type { Jira } from '../../jira-oidc-helpers';
import type { AppStorage } from '../../jira/storage/common';
import type { ConnectMigrationGroupId, ConnectMigrationProbe } from '../services/reports-storage';

import React, { useState } from 'react';
import { ErrorBoundary } from '@sentry/react';
import { QueryClientProvider } from '@tanstack/react-query';
import Button from '@atlaskit/button/new';
import SectionMessage from '@atlaskit/section-message';

import MigrateConnectDataModal from '../SettingsSidebar/components/Storage/components/MigrateConnectDataModal';
import { JiraProvider } from '../services/jira';
import { queryClient } from '../services/query';
import { useConnectMigrationStatus, useMigrateConnectData } from '../services/reports-storage';
import { StorageProvider } from '../services/storage';
import { reloadApp } from '../../shared/reload-app';

interface ConnectMigrationBannerWrapperProps {
  storage: AppStorage;
  jira: Jira;
}

/**
 * Offers the one-time Connect→KVS copy at the top of the app, on the Forge host only.
 *
 * Silent on any error: the banner is an aside, and a failed probe must not take the report with it.
 * See spec/021-forge/resolver-storage/migration-option.plan.md § The banner.
 */
const ConnectMigrationBannerWrapper: FC<ConnectMigrationBannerWrapperProps> = ({ storage, jira }) => {
  // Checked here as well as in the query, so the web build never mounts any of this.
  if (jira?.host !== 'forge') {
    return null;
  }

  return (
    <ErrorBoundary fallback={<></>}>
      <StorageProvider storage={storage}>
        <JiraProvider jira={jira}>
          <QueryClientProvider client={queryClient}>
            <ConnectMigrationBanner />
          </QueryClientProvider>
        </JiraProvider>
      </StorageProvider>
    </ErrorBoundary>
  );
};

export default ConnectMigrationBannerWrapper;

export const ConnectMigrationBanner: FC = () => {
  const probe = useConnectMigrationStatus();
  // "Not now" is for this session only. There is no permanent dismissal: the Storage panel is gated
  // behind a feature flag that is off on a fresh KVS store, so a banner dismissed forever would
  // leave no way back to the data.
  const [isDismissed, setIsDismissed] = useState(false);

  if (!probe || isDismissed) {
    return null;
  }

  return <ConnectMigrationPrompt probe={probe} onDismiss={() => setIsDismissed(true)} />;
};

export const ConnectMigrationPrompt: FC<{ probe: ConnectMigrationProbe; onDismiss: () => void }> = ({
  probe,
  onDismiss,
}) => {
  const { migrate, progress, resetProgress } = useMigrateConnectData();
  const [isOpen, setIsOpen] = useState(false);
  const [selected, setSelected] = useState<ConnectMigrationGroupId[]>(probe.available);

  return (
    <div className="pt-4">
      <SectionMessage
        appearance="discovery"
        title="Bring over your existing data"
        actions={[
          <Button
            key="copy"
            appearance="primary"
            onClick={() => {
              resetProgress();
              setIsOpen(true);
            }}
          >
            Copy my data
          </Button>,
          <Button key="dismiss" appearance="subtle" onClick={onDismiss}>
            Not now
          </Button>,
        ]}
      >
        <p className="text-sm">
          Your saved reports, team settings, appearance and feature toggles from the previous version of Status Reports
          can be copied into this one.
          {probe.reportsConfig.kind === 'space' && (
            <>
              {' '}
              Your saved reports are in <span className="font-semibold">{probe.reportsConfig.spaceName}</span>; this
              version will keep using it.
            </>
          )}
        </p>
      </SectionMessage>

      <MigrateConnectDataModal
        isOpen={isOpen}
        probe={probe}
        selected={selected}
        progress={progress}
        onToggle={(id, isChecked) =>
          setSelected((current) => (isChecked ? [...current, id] : current.filter((groupId) => groupId !== id)))
        }
        onMigrate={async () => {
          const result = await migrate(selected);

          // Failures keep the modal open with the list; pressing Copy again overwrites and repairs.
          if (result.failures.length) {
            return;
          }

          // `features` changes which panels render and `theme` the whole look — a full reload, not
          // query invalidation. Not `window.location.reload()`: see shared/reload-app.ts.
          reloadApp();
        }}
        onClose={() => setIsOpen(false)}
      />
    </div>
  );
};
