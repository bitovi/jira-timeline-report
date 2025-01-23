import type { Theme } from "./fetcher";

import { getTextColorUsingAPCA } from "../../utils/color";

export const applyThemeToCssVars = (theme?: Theme) => {
  for (const { backgroundColor, textCssVar, backgroundCssVar } of Object.values(theme || {})) {
    document.documentElement.style.setProperty(backgroundCssVar, backgroundColor);
    document.documentElement.style.setProperty(textCssVar, getTextColorUsingAPCA(backgroundColor));
  }
};
