import { AppStorage } from "../storage/common";

const defaultTheme = {
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
};

export type Theme = typeof defaultTheme;

type SavedTheme = Record<keyof Theme, { color: string }>;

const themeKey = "theme";

export const getTheme = (storage: AppStorage): Promise<Theme> => {
  return storage.get<SavedTheme>(themeKey).then((saved) => {
    const merged = structuredClone(defaultTheme);

    for (const [name, themeValues] of Object.entries(saved || {})) {
      const key = name as keyof Theme;
      merged[key] = { ...merged[key], color: themeValues.color };
    }

    return merged;
  });
};

export const updateTheme = (storage: AppStorage, updates: Theme): Promise<void> => {
  const reduced = {} as SavedTheme;

  for (const [name, themeValues] of Object.entries(updates)) {
    const key = name as keyof Theme;
    reduced[key] = { color: themeValues.color };
  }

  return storage.update(themeKey, reduced);
};
