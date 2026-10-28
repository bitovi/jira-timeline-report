import type { ComponentProps, FC } from 'react';

import React, { useRef, useState } from 'react';
import Heading from '@atlaskit/heading';
import AddIcon from '@atlaskit/icon/core/add';

import SidebarButton from '../../../components/SidebarButton';
import { getButtonClasses } from '../../../components/SidebarButton/SidebarButton';
import Link from '../../../services/routing/Link';
import { hasUnsavedReport } from '../../../SaveReports/hooks/useSelectedReports/utilities';
import LeaveReportModal from './components/LeaveReportModal';
import Branding from '../Branding';
import FeatureRequestModal from './components/FeatureRequestModal';
import BugReportModal from './components/BugReportModal';

interface ReportSettingsProps {
  changeSettings: (setting: string) => void;
  showSidebarBranding: boolean;
  /**
   * Behind the `reportsStorage` feature flag, resolved by the parent — this component renders
   * outside any provider in its own test, so it takes the answer rather than asking for it.
   */
  showStorage?: boolean;
  /** The host reported an inactive license; resolved by the parent for the same reason. */
  unlicensed?: boolean;
  /** Renders the New Report link. See `SettingsSidebar`'s `onNewReport`. */
  onNewReport?: () => void;
}

const ReportSettings: FC<ReportSettingsProps> = ({
  changeSettings,
  showSidebarBranding,
  showStorage = false,
  unlicensed = false,
  onNewReport,
}) => {
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const [isBugFormOpen, setIsBugFormOpen] = useState(false);

  // New Report asks first when it would drop unsaved changes. The check runs in the capture phase because
  // `Link` navigates inside its own click handler on the embedded hosts — by the time `onClick` ran,
  // the report would already be gone. "Leave" re-clicks the same link, so navigation still goes
  // through `Link`'s host-specific handling.
  const newReportRef = useRef<HTMLAnchorElement>(null);
  const leaveConfirmed = useRef(false);
  const [isLeaveModalOpen, setIsLeaveModalOpen] = useState(false);

  return (
    // `flex flex-col` so the help icon below sits at the bottom (`mt-auto`) under the nav buttons.
    <div className="flex h-full flex-col overflow-hidden px-6 pt-6 pb-2">
      <div className="shrink-0">
        {showSidebarBranding && <Branding unlicensed={unlicensed} />}
        {onNewReport && (
          // A link to a blank report with Sources open, not a button: it drops every report param at
          // once, goes through the host's link handling like a saved-report link, and can open in a
          // new tab.
          <div className="pb-4">
            <Link
              ref={newReportRef}
              href="?settings=SOURCES"
              onClickCapture={(event) => {
                if (leaveConfirmed.current) {
                  leaveConfirmed.current = false;

                  return;
                }

                if (hasUnsavedReport(window.location.search)) {
                  event.preventDefault();
                  event.stopPropagation();
                  setIsLeaveModalOpen(true);
                }
              }}
              onClick={onNewReport}
              className={`${getButtonClasses(false, '')} no-underline`}
            >
              <AddIcon label="" color="currentColor" />
              New Report
            </Link>
          </div>
        )}
        <LeaveReportModal
          isOpen={isLeaveModalOpen}
          onStay={() => setIsLeaveModalOpen(false)}
          onLeave={() => {
            setIsLeaveModalOpen(false);
            leaveConfirmed.current = true;
            newReportRef.current?.click();
          }}
        />
        <div className="pb-1">
          <Heading size="xsmall">
            <span className="uppercase">Report Settings</span>
          </Heading>
        </div>
        <SidebarButton onClick={() => changeSettings('SOURCES')}>
          <img src="./images/magnifying-glass.svg" aria-hidden />
          Sources
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('TIMING')}>
          <img src="./images/calendar.svg" aria-hidden />
          Timing
        </SidebarButton>

        <div className="pt-6 pb-1">
          <Heading size="xsmall">
            <span className="uppercase">Global Settings</span>
          </Heading>
        </div>

        <SidebarButton onClick={() => changeSettings('TEAMS')}>
          <img src="./images/team.svg" aria-hidden />
          Teams
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('FEATURES')}>
          <img src="./images/features.svg" aria-hidden />
          Features
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('THEME')}>
          <img src="./images/theme.svg" className="w-[18px]" aria-hidden />
          Theme
        </SidebarButton>
        {showStorage && (
          <SidebarButton onClick={() => changeSettings('STORAGE')}>
            <img src="./images/storage.svg" className="w-[18px]" aria-hidden />
            Storage
          </SidebarButton>
        )}
      </div>

      {/*
        Only the help icon shows; hovering the bottom strip of the sidebar (or focusing the icon)
        slides the links up above it. The panel overlays the nav buttons instead of taking space,
        so short windows no longer have to clip links. It comes after the button in the DOM so
        Tab goes icon -> links. `invisible` keeps hidden links out of the tab order and pointer.
      */}
      <div className="group relative mt-auto flex shrink-0 justify-center pt-2">
        <button type="button" aria-label="Help" className="rounded-full p-1">
          <img width="24px" src="./images/_QuestionCircleIcon_.svg" aria-hidden />
        </button>
        <div
          className="invisible absolute inset-x-0 bottom-full flex translate-y-2 flex-col items-center gap-2 bg-white
            pt-4 pb-2 opacity-0 transition-[opacity,transform,visibility] duration-200 ease-out
            group-focus-within:visible group-focus-within:translate-y-0 group-focus-within:opacity-100
            group-hover:visible group-hover:translate-y-0 group-hover:opacity-100"
        >
          <SmallLink href="https://bitovi.atlassian.net/wiki/spaces/StatusReportsForJira/overview">
            Read the guides
          </SmallLink>
          <SmallLink href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira.html">
            APM Training
          </SmallLink>
          <SmallLink href="https://www.bitovi.com/services/agile-project-management-consulting">
            Connect with Bitovi
          </SmallLink>
          <SmallLink href="https://www.bitovi.com/status-reports-for-jira">Join the Mailing List</SmallLink>
          <button className="link shrink-0 text-slate-300 text-sm" onClick={() => setIsBugFormOpen(true)}>
            Report a bug
          </button>
          <button className="link shrink-0 text-slate-300 text-sm" onClick={() => setIsFeedbackFormOpen(true)}>
            Request a feature
          </button>
          <SmallLink href="https://marketplace.atlassian.com/apps/1236390/status-reports-for-jira?hosting=cloud&tab=reviews">
            Write a review
          </SmallLink>
        </div>
      </div>
      <BugReportModal isOpen={isBugFormOpen} onClose={() => setIsBugFormOpen(false)} />
      <FeatureRequestModal isOpen={isFeedbackFormOpen} onClose={() => setIsFeedbackFormOpen(false)} />
    </div>
  );
};

export default ReportSettings;

const SmallLink: FC<Omit<ComponentProps<'a'>, 'className' | 'target'>> = ({ href, children, ...rest }) => {
  return (
    <a className="link shrink-0 text-slate-300 text-sm" target="_blank" href={href} {...rest} rel="noopener noreferrer">
      {children}
    </a>
  );
};
