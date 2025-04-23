import type { ComponentProps, FC } from "react";

import React, { useState } from "react";
import Heading from "@atlaskit/heading";
import { useFlags } from "@atlaskit/flag";
import { getFeedback } from "@sentry/react";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

import SidebarButton from "../../../components/SidebarButton";
import Branding from "../Branding";
import FeatureRequestModal from "./components/FeatureRequestModal";

const useBugForm = () => {
  const { showFlag } = useFlags();

  return async () => {
    try {
      const form = await getFeedback()?.createForm();

      if (!form) {
        console.error(["useBugForm", "Could not create form"].join("\n"));
        throw new Error("Could not create form");
      }

      form.appendToDom();
      form.open();
    } catch {
      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description: "Something went wrong, please try again later.",
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });
    }
  };
};

interface ReportSettingsProps {
  changeSettings: (setting: string) => void;
  showSidebarBranding: boolean;
}

const ReportSettings: FC<ReportSettingsProps> = ({ changeSettings, showSidebarBranding }) => {
  const [isFeedbackFormOpen, setIsFeedbackFormOpen] = useState(false);
  const showBugForm = useBugForm();

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
        <button className="link text-slate-300 text-sm" onClick={showBugForm}>
          Report a bug
        </button>
        <button className="link text-slate-300 text-sm" onClick={() => setIsFeedbackFormOpen(true)}>
          Request a feature
        </button>
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
