import type { Theme } from "../../../jira/theme";

import { useSuspenseQuery } from "@tanstack/react-query";

import { useStorage } from "../../services/storage";
import { themeKeys } from "./key-factory";
import { applyThemeToCssVars, getTheme } from "../../../jira/theme";

export type UseTheme = () => Theme;

export const useTheme: UseTheme = () => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: themeKeys.theme,
    queryFn: async () => {
      const theme = await getTheme(storage);

      applyThemeToCssVars(theme);

      console.log(document.documentElement.style);

      return theme;
    },
  });

  return data;
};
