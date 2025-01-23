import type { FC } from "react";

import React, { useEffect, useState } from "react";
import SidebarButton from "../components/SidebarButton";

import ArrowLeftCircleIcon from "@atlaskit/icon/glyph/arrow-left-circle";
import Heading from "@atlaskit/heading";
import Lozenge from "@atlaskit/lozenge";
import { getTextColorUsingAPCA } from "../../utils/color";
import { useTheme } from "../services/theme/useTheme";
import { useSaveTheme } from "../services/theme/useSaveTheme";
import { applyThemeToCssVars, defaultTheme, Theme } from "../../jira/theme";
import { useDebounce } from "../hooks/useDebounce";
import Spinner from "@atlaskit/spinner";
import Button from "@atlaskit/button/new";

interface ThemeProps {
  onBackButtonClicked: () => void;
}

const Theme: FC<ThemeProps> = ({ onBackButtonClicked }) => {
  const theme = useTheme();
  const { save, isPending } = useSaveTheme();

  const [localTheme, setLocalTheme] = useState(theme);

  const updateLocalTheme = (newLocalTheme: Theme) => {
    applyThemeToCssVars(newLocalTheme);
    setLocalTheme(newLocalTheme);
  };

  const debouncedTheme = useDebounce(localTheme, 500);

  useEffect(() => {
    if (JSON.stringify(theme) === JSON.stringify(debouncedTheme)) {
      return;
    }

    save(debouncedTheme);
  }, [debouncedTheme, save]);

  return (
    <>
      <SidebarButton onClick={onBackButtonClicked}>
        <ArrowLeftCircleIcon label="go back" />
        Go back
      </SidebarButton>
      <div className="my-4">
        <div className="flex justify-between">
          <Heading size="small">Theme</Heading>
          {isPending && <Spinner size="small" />}
        </div>
        <div className="pt-6 flex flex-col gap-8">
          {Object.entries(localTheme).map(
            ([key, { textCssVar, backgroundColor, description, backgroundCssVar, label }]) => {
              return (
                <div key={label}>
                  <div className="flex gap-4 justify-between items-center">
                    <div className="flex flex-col gap-2 items-start">
                      <Lozenge
                        style={{
                          backgroundColor: `var(${backgroundCssVar})`,
                          color: `var(${textCssVar})`,
                        }}
                      >
                        {label}
                      </Lozenge>
                      <div className="text-xs text-slate-700">{description}</div>
                    </div>
                    <input
                      type="color"
                      className="flex-shrink-0 h-11 min-w-20"
                      value={backgroundColor}
                      onChange={({ target }) => {
                        const newColor = target.value;
                        updateLocalTheme({
                          ...theme,
                          [key]: {
                            ...theme[key as keyof typeof theme],
                            backgroundColor: newColor,
                            textColor: getTextColorUsingAPCA(newColor),
                          },
                        });
                      }}
                    />
                  </div>
                </div>
              );
            }
          )}
        </div>
        <div className="pt-8 [&>button]:!w-full">
          <Button onClick={() => updateLocalTheme(defaultTheme)}>Reset theme</Button>
        </div>
      </div>
    </>
  );
};

export default Theme;
