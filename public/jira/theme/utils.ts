import type { Theme } from "./fetcher";

export const applyThemeToCssVars = (theme?: Theme) => {
  for (const { cssVar, color, label } of Object.values(theme || {})) {
    document.documentElement.style.setProperty(cssVar, color);
  }
};
