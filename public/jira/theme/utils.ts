import type { Theme } from "./fetcher";

export const applyThemeToCssVars = (theme?: Theme) => {
  for (const { backgroundColor, textColor, textCssVar, backgroundCssVar } of Object.values(
    theme || {}
  )) {
    document.documentElement.style.setProperty(backgroundCssVar, backgroundColor);
    document.documentElement.style.setProperty(textCssVar, textColor);
  }
};
