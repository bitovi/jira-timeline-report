import type { FC } from "react";

import React, { useEffect, useState } from "react";
import SidebarButton from "../components/SidebarButton";

import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";
import Heading from "@atlaskit/heading";
import Lozenge from "@atlaskit/lozenge";
import { getTextColorUsingAPCA } from "../../utils/color";
import { useTheme } from "../services/theme/useTheme";
import { useSaveTheme } from "../services/theme/useSaveTheme";
import { applyThemeToCssVars, Theme } from "../../jira/theme";
import { useDebounce } from "../hooks/useDebounce";

interface ThemeProps {
  onBackButtonClicked: () => void;
}

const Theme: FC<ThemeProps> = ({ onBackButtonClicked }) => {
  const theme = useTheme();
  const { save } = useSaveTheme();

  const [localTheme, setLocalTheme] = useState(theme);

  const updateLocalTheme = (t: Theme) => {
    applyThemeToCssVars(t);
    setLocalTheme(t);
  };

  const debouncedTheme = useDebounce(localTheme, 1_000);

  useEffect(() => {
    save(debouncedTheme);
  }, [debouncedTheme, save]);

  return (
    <>
      <SidebarButton onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        Go back
      </SidebarButton>
      <div className="my-4">
        <Heading size="small">Theme</Heading>
        <div className="pt-6 flex flex-col gap-8">
          {Object.entries(localTheme).map(([key, { color, description, cssVar, label }]) => {
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
                    onChange={({ target }) => {
                      updateLocalTheme({
                        ...theme,
                        [key]: { ...theme[key as keyof typeof theme], color: target.value },
                      });
                    }}
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
