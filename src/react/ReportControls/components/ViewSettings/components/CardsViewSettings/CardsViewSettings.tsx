import type { FC } from 'react';

import React from 'react';

import SettingsSection from '../../shared/components/SettingsSection';
import CardsMode from '../../shared/components/CardsMode';
import StatusesShownAsPlanning from '../../shared/components/StatusesShownAsPlanning';

/**
 * View settings for the Cards report: which of its two views to show, and which statuses are held
 * back into the "Planning" card.
 *
 * Both used to live under the Gantt's and the Scatter Plot's "secondary report" heading, gated on the
 * `secondaryReport` flag. `StatusesShownAsPlanning` stays there too — it feeds the view model's
 * planning filter for *every* report, not just this one. See spec/018-card-report/alt-plan.md.
 */
const CardsViewSettings: FC = () => (
  <div>
    <SettingsSection title="cards mode" centered>
      <CardsMode />
    </SettingsSection>
    <SettingsSection title="statuses shown as planning" centered>
      <StatusesShownAsPlanning />
    </SettingsSection>
  </div>
);

export default CardsViewSettings;
