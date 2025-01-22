import type { FC } from "react";

import React from "react";
import SidebarButton from "../components/SidebarButton";

import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";
import Heading from "@atlaskit/heading";
import Lozenge from "@atlaskit/lozenge";
import { getTextColorUsingAPCA } from "../../utils/color";

interface ThemeProps {
  onBackButtonClicked: () => void;
}

const Theme: FC<ThemeProps> = ({ onBackButtonClicked }) => {
  return (
    <>
      <SidebarButton onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        Go back
      </SidebarButton>
      <div className="my-4">
        <Heading size="small">Team Configuration</Heading>
        <div className="pt-6 flex flex-col gap-8">
          {Object.values(theme).map(({ color, description, cssVar, label }) => {
            return (
              <div key={label}>
                <div className="flex gap-4 justify-between items-center">
                  <div className="flex flex-col gap-2 items-start">
                    <Lozenge
                      style={{
                        backgroundColor: `var(${cssVar})`,
                        color: getTextColorUsingAPCA(color),
                      }}
                    >
                      {label}
                    </Lozenge>
                    <div className="text-xs text-slate-700">{description}</div>
                  </div>
                  <input
                    type="color"
                    className="flex-shrink-0 h-11 min-w-20"
                    value={color}
                    onChange={({ target }) =>
                      document.documentElement.setAttribute("style", `${cssVar}: ${target.value}`)
                    }
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default Theme;

const theme = {
  complete: {
    label: "Complete",
    description: `End date in the past`,
    color: "#22A06B",
    cssVar: "--complete-color",
  },
  blocked: {
    label: "Blocked",
    description: `Has Jira status of "blocked" or label of "blocked"`,
    color: "#E2483D",
    cssVar: "--blocked-color",
  },
  warning: {
    label: "Warning",
    description: `Has Jira status of "warning" or label of "warning"`,
    color: "#FF8E09",
    cssVar: "--warning-color",
  },
  new: {
    label: "New",
    description: `Issue did not exist in "last period"`,
    color: "#8F7EE7",
    cssVar: "--new-color",
  },
  behind: {
    label: "Behind",
    description: `End date "today" is later than end date in "last period"`,
    color: "#F5CD47",
    cssVar: "--behind-color",
  },
  ahead: {
    label: "Ahead",
    description: `End date "today" is earlier than end date in "last period"`,
    color: "#2898BD",
    cssVar: "--ahead-color",
  },
  onTrack: {
    label: "On Track",
    description: `Timing didn't change, starts before now, ends after now`,
    color: "#388BFF",
    cssVar: "--ontrack-color",
  },
  notStarted: {
    label: "Not Started",
    description: `Start date is after now`,
    color: "#8590A2",
    cssVar: "--notstarted-color",
  },
} as const;

//@ts-ignore
window.theme = theme;
