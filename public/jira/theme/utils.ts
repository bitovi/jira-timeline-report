import type { Theme } from "./fetcher";

export const applyThemeToCssVars = (theme?: Theme) => {
  for (const { cssVar, color, label } of Object.values(theme || {})) {
    console.log("updating ", label, `${cssVar}: ${color};`);
    document.documentElement.style.setProperty(cssVar, color);
  }
};
