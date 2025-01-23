import { getTextColorUsingAPCA } from "../../utils/color";
import { AppStorage } from "../storage/common";

const defaultTheme = {
  complete: {
    label: "Complete",
    description: `End date in the past`,
    backgroundColor: "#22A06B",
    backgroundCssVar: "--complete-color",
    textColor: "--complete-text-color",
    textCssVar: "#FFFFFF",
  },
  blocked: {
    label: "Blocked",
    description: `Has Jira status of "blocked" or label of "blocked"`,
    backgroundColor: "#E2483D",
    backgroundCssVar: "--blocked-color",
    textColor: "#FFFFFF",
    textCssVar: "--blocked-text-color",
  },
  warning: {
    label: "Warning",
    description: `Has Jira status of "warning" or label of "warning"`,
    backgroundColor: "#FF8E09",
    backgroundCssVar: "--warning-color",
    textColor: "#000000",
    textCssVar: "--warning-text-color",
  },
  new: {
    label: "New",
    description: `Issue did not exist in "last period"`,
    backgroundColor: "#8F7EE7",
    backgroundCssVar: "--new-color",
    textColor: "#FFFFFF",
    textCssVar: "--new-text-color",
  },
  behind: {
    label: "Behind",
    description: `End date "today" is later than end date in "last period"`,
    backgroundColor: "#F5CD47",
    backgroundCssVar: "--behind-color",
    textColor: "#000000",
    textCssVar: "--behind-text-color",
  },
  ahead: {
    label: "Ahead",
    description: `End date "today" is earlier than end date in "last period"`,
    backgroundColor: "#2898BD",
    backgroundCssVar: "--ahead-color",
    textColor: "#fff",
    textCssVar: "--ahead-text-color",
  },
  onTrack: {
    label: "On Track",
    description: `Timing didn't change, starts before now, ends after now`,
    backgroundColor: "#388BFF",
    backgroundCssVar: "--ontrack-color",
    textColor: "#FFFFFF",
    textCssVar: "--ontrack-text-color",
  },
  notStarted: {
    label: "Not Started",
    description: `Start date is after now`,
    backgroundColor: "#8590A2",
    backgroundCssVar: "--notstarted-color",
    textColor: "#fff",
    textCssVar: "--notstarted-text-color",
  },
};

export type Theme = typeof defaultTheme;

type SavedTheme = Record<keyof Theme, { backgroundColor: string }>;

const themeKey = "theme";

export const getTheme = (storage: AppStorage): Promise<Theme> => {
  return storage.get<SavedTheme>(themeKey).then((saved) => {
    const merged = structuredClone(defaultTheme);

    for (const [name, themeValues] of Object.entries(saved || {})) {
      const key = name as keyof Theme;
      merged[key] = {
        ...merged[key],
        backgroundColor: themeValues.backgroundColor,
        textColor: getTextColorUsingAPCA(themeValues.backgroundColor),
      };
    }

    return merged;
  });
};

export const updateTheme = (storage: AppStorage, updates: Theme): Promise<void> => {
  const reduced = {} as SavedTheme;

  for (const [name, themeValues] of Object.entries(updates)) {
    const key = name as keyof Theme;
    reduced[key] = { backgroundColor: themeValues.backgroundColor };
  }

  return storage.update(themeKey, reduced);
};
