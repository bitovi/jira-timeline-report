import type { ComponentProps, FC } from 'react';

import React, { useState } from 'react';
import Heading from '@atlaskit/heading';

import SidebarButton from '../../../components/SidebarButton';
import Branding from '../Branding';
import FeatureRequestModal from './components/FeatureRequestModal';
import BugReportModal from './components/BugReportModal';

interface ReportSettingsProps {
  changeSettings: (setting: string) => void;
  showSidebarBranding: boolean;
}

const ReportSettings: FC<ReportSettingsProps> = ({ changeSettings, showSidebarBranding }) => {
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const [isBugFormOpen, setIsBugFormOpen] = useState(false);

  return (
    // `flex flex-col` so the footer links section below can be squeezed by the (shrink-0) nav
    // buttons instead of overlapping them via `position: fixed` (the previous approach).
    <div className="flex h-full flex-col overflow-hidden px-6 pt-6 pb-2">
      <div className="shrink-0">
        {showSidebarBranding && <Branding />}
        <div className="pb-1">
          <Heading size="xsmall">
            <span className="uppercase">Report Settings</span>
          </Heading>
        </div>
        <SidebarButton onClick={() => changeSettings('SOURCES')}>
          <img src="/images/magnifying-glass.svg" aria-hidden />
          Sources
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('TIMING')}>
          <img src="/images/calendar.svg" aria-hidden />
          Timing
        </SidebarButton>

        <div className="pt-6 pb-1">
          <Heading size="xsmall">
            <span className="uppercase">Global Settings</span>
          </Heading>
        </div>

        <SidebarButton onClick={() => changeSettings('TEAMS')}>
          <img src="/images/team.svg" aria-hidden />
          Teams
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('FEATURES')}>
          <img src="/images/features.svg" aria-hidden />
          Features
        </SidebarButton>
        <SidebarButton onClick={() => changeSettings('THEME')}>
          <img src="/images/theme.svg" className="w-[18px]" aria-hidden />
          Theme
        </SidebarButton>
      </div>

      {/*
        The footer links section is allowed to shrink (`min-h-0`, default is `min-h-full` i.e.
        `auto`/content-size, which is what caused the old `position: fixed` block to overlap the
        nav buttons above on short windows). Its children are never explicitly shrunk (`shrink-0`)
        since their own text already gives them a natural minimum height - there's nothing to gain
        by asking them to shrink. Instead, once this section's box is forced smaller than its
        content, the lowest (least important) links simply overflow past its bottom edge and get
        clipped by `overflow-hidden` - automatically dropping least-important-first, with no
        per-item tuning or height media queries needed. The `after:` gradient softens whichever
        link happens to be straddling that cutoff so it fades rather than hard-clipping mid-glyph.
      */}
      <div
        className="relative mt-auto flex min-h-0 shrink flex-col items-center gap-2 overflow-hidden pt-2
          after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-2
          after:bg-gradient-to-b after:from-transparent after:to-white after:content-['']"
      >
        <img className="shrink-0 pb-2" width="24px" src="./images/_QuestionCircleIcon_.svg" aria-hidden />
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
        <BugReportModal isOpen={isBugFormOpen} onClose={() => setIsBugFormOpen(false)} />
        <button className="link shrink-0 text-slate-300 text-sm" onClick={() => setIsFeedbackFormOpen(true)}>
          Request a feature
        </button>
        <SmallLink href="https://marketplace.atlassian.com/apps/1236390/status-reports-for-jira?hosting=cloud&tab=reviews">
          Write a review
        </SmallLink>
        <FeatureRequestModal isOpen={isFeedbackFormOpen} onClose={() => setIsFeedbackFormOpen(false)} />
      </div>
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
