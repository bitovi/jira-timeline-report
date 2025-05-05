import type { ComponentProps, FC } from "react";

import React, { useState } from "react";
import Heading from "@atlaskit/heading";

import SidebarButton from "../../../components/SidebarButton";
import Branding from "../Branding";
import FeatureRequestModal from "./components/FeatureRequestModal";
import BugReportModal from "./components/BugReportModal";

interface ReportSettingsProps {
  changeSettings: (setting: string) => void;
  showSidebarBranding: boolean;
}

const ReportSettings: FC<ReportSettingsProps> = ({ changeSettings, showSidebarBranding }) => {
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const [isBugFormOpen, setIsBugFormOpen] = useState(false);

  return (
    <div className="px-6 pt-6 pb-2">
      {showSidebarBranding && <Branding />}
      <div className="pb-1">
        <Heading size="xsmall">
          <span className="uppercase">Report Settings</span>
        </Heading>
      </div>
      <SidebarButton onClick={() => changeSettings("SOURCES")}>
        <img src="/images/magnifying-glass.svg" aria-hidden />
        Sources
      </SidebarButton>
      <SidebarButton onClick={() => changeSettings("TIMING")}>
        <img src="/images/calendar.svg" aria-hidden />
        Timing
      </SidebarButton>

      <div className="pt-6 pb-1">
        <Heading size="xsmall">
          <span className="uppercase">Global Settings</span>
        </Heading>
      </div>

      <SidebarButton onClick={() => changeSettings("TEAMS")}>
        <img src="/images/team.svg" aria-hidden />
        Teams
      </SidebarButton>
      <SidebarButton onClick={() => changeSettings("FEATURES")}>
        <img src="/images/features.svg" aria-hidden />
        Features
      </SidebarButton>
      <SidebarButton onClick={() => changeSettings("THEME")}>
        <img src="/images/theme.svg" className="w-[18px]" aria-hidden />
        Theme
      </SidebarButton>
      <div className="fixed bottom-4 grid justify-items-center gap-2 p-1">
        <img className="pb-2" width="24px" src="./images/_QuestionCircleIcon_.svg" aria-hidden />
        <SmallLink href="https://bitovi.atlassian.net/wiki/spaces/StatusReportsForJira/overview">
          Read the guides
        </SmallLink>
        <SmallLink href="https://www.bitovi.com/academy/learn-agile-program-management-with-jira.html">
          APM Training
        </SmallLink>
        <SmallLink href="https://www.bitovi.com/services/agile-project-management-consulting">
          Connect with Bitovi
        </SmallLink>
        <button className="link text-slate-300 text-sm" onClick={() => setIsBugFormOpen(true)}>
          Report a bug
        </button>
        <BugReportModal isOpen={isBugFormOpen} onClose={() => setIsBugFormOpen(false)} />
        <button className="link text-slate-300 text-sm" onClick={() => setIsFeedbackFormOpen(true)}>
          Request a feature
        </button>
        <SmallLink href="https://marketplace.atlassian.com/apps/1236390/status-reports-for-jira?hosting=cloud&tab=reviews">
          Write a review
        </SmallLink>
        <FeatureRequestModal
          isOpen={isFeedbackFormOpen}
          onClose={() => setIsFeedbackFormOpen(false)}
        />
      </div>
    </div>
  );
};

export default ReportSettings;

const SmallLink: FC<Omit<ComponentProps<"a">, "className" | "target">> = ({
  href,
  children,
  ...rest
}) => {
  return (
    <a className="link text-slate-300 text-sm" target="_blank" href={href} {...rest}>
      {children}
    </a>
  );
};
