import React, { FC } from 'react';

import TeamConfiguration from './components/TeamConfiguration';
import ReportSettings from './components/ReportSettings';
import IssueSource from './components/IssueSource';
import TimingCalculation from './components/TimingCalculation';
import Theme from './components/Theme';
import SidebarLayout from './components/SidebarLayout';
import Features from './components/Features';
import AnimatedSidebar from './components/AnimatedSidebar';
import { value } from '../../can';
import routeData from '../../canjs/routing/route-data';
import { CanObservable } from '../hooks/useCanObservable';
import { useRouteData } from '../hooks/useRouteData';
import { NormalizeIssueConfig } from '../../jira/normalized/normalize';

export interface SettingsSidebarProps {
  showSidebarBranding: boolean;
  onUpdateTeamsConfiguration: (overrides: Partial<NormalizeIssueConfig & { fields: string[] }>) => void;
}

const SettingsSidebar: FC<SettingsSidebarProps> = ({ showSidebarBranding, onUpdateTeamsConfiguration }) => {
  const [showSettings] = useRouteData<string>('showSettings');
  const derivedIssuesObservable: CanObservable<{ status: string; team: { name: string } }[]> = value.from(
    routeData,
    'derivedIssues',
  );

  const changeSettings = (settings = '') => {
    routeData.showSettings = settings;
  };

  const returnToSettings = () => changeSettings('');

  return (
    <AnimatedSidebar>
      {!showSettings && <ReportSettings showSidebarBranding={showSidebarBranding} changeSettings={changeSettings} />}
      {showSettings === 'SOURCES' && (
        <SidebarLayout onGoBack={returnToSettings} className="w-96">
          <IssueSource />
        </SidebarLayout>
      )}
      {showSettings === 'TIMING' && (
        <SidebarLayout onGoBack={returnToSettings}>
          <TimingCalculation />
        </SidebarLayout>
      )}
      {showSettings === 'TEAMS' && (
        // Special case
        <div className="h-full">
          <TeamConfiguration
            derivedIssuesObservable={derivedIssuesObservable}
            onUpdate={onUpdateTeamsConfiguration}
            onBackButtonClicked={() => returnToSettings()}
          />
        </div>
      )}
      {showSettings === 'FEATURES' && (
        <SidebarLayout onGoBack={returnToSettings}>
          <Features />
        </SidebarLayout>
      )}
      {showSettings === 'THEME' && (
        <SidebarLayout onGoBack={returnToSettings} className="w-80">
          <Theme onBackButtonClicked={changeSettings} />
        </SidebarLayout>
      )}
    </AnimatedSidebar>
  );
};

export default SettingsSidebar;
