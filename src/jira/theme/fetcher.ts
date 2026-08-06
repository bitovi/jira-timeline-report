import { AppStorage } from '../storage/common';

/**
 * Which part of the Theme panel an entry belongs to — and, more importantly, who is allowed to
 * render it. The report footer's status legend (`StatusKey`) maps the whole theme array, so an
 * entry that isn't a status has to be excluded there or it shows up as a legend chip.
 */
export type ThemeGroup = 'status' | 'reportOfReports';

export interface ThemeItem {
  label: string;
  description: string;
  backgroundColor: string;
  backgroundCssVar: string;
  textCssVar: string;
  group: ThemeGroup;
}

export const defaultTheme: ThemeItem[] = [
  {
    label: 'Complete',
    description: `End date in the past`,
    backgroundColor: '#22A06B',
    backgroundCssVar: '--complete-color',
    textCssVar: '--complete-text-color',
    group: 'status',
  },
  {
    label: 'Blocked',
    description: `Has Jira status of "blocked" or label of "blocked"`,
    backgroundColor: '#E2483D',
    backgroundCssVar: '--blocked-color',
    textCssVar: '--blocked-text-color',
    group: 'status',
  },
  {
    label: 'Warning',
    description: `Has Jira status of "warning" or label of "warning"`,
    backgroundColor: '#FF8E09',
    backgroundCssVar: '--warning-color',
    textCssVar: '--warning-text-color',
    group: 'status',
  },
  {
    label: 'New',
    description: `Issue did not exist in "last period"`,
    backgroundColor: '#8F7EE7',
    backgroundCssVar: '--new-color',
    textCssVar: '--new-text-color',
    group: 'status',
  },
  {
    label: 'Behind',
    description: `End date "today" is later than end date in "last period"`,
    backgroundColor: '#F5CD47',
    backgroundCssVar: '--behind-color',
    textCssVar: '--behind-text-color',
    group: 'status',
  },
  {
    label: 'Ahead',
    description: `End date "today" is earlier than end date in "last period"`,
    backgroundColor: '#2898BD',
    backgroundCssVar: '--ahead-color',
    textCssVar: '--ahead-text-color',
    group: 'status',
  },
  {
    label: 'On Track',
    description: `Timing didn't change, starts before now, ends after now`,
    backgroundColor: '#388BFF',
    backgroundCssVar: '--ontrack-color',
    textCssVar: '--ontrack-text-color',
    group: 'status',
  },
  {
    label: 'Not Started',
    description: `Start date is after now`,
    backgroundColor: '#8590A2',
    backgroundCssVar: '--notstarted-color',
    textCssVar: '--notstarted-text-color',
    group: 'status',
  },
  {
    label: 'Section',
    description: `Background behind each section in a report of reports`,
    // White reads identically to the transparent sections shipped today, so adding this entry
    // changes nothing until someone picks a color.
    backgroundColor: '#FFFFFF',
    backgroundCssVar: '--section-color',
    textCssVar: '--section-text-color',
    group: 'reportOfReports',
  },
];

export type Theme = ThemeItem[];

type SavedTheme = Array<{ label: string; backgroundColor: string }>;

const themeKey = 'theme';

/**
 * Merges saved colors into `defaultTheme` by label. Only `{label, backgroundColor}` is ever
 * persisted, so everything else — css vars, descriptions, `group` — is re-derived from the defaults
 * on each read. That is what makes appending a new entry backward compatible with no migration: a
 * theme saved before the entry existed simply has no row for that label and falls through.
 */
export const getTheme = (storage: AppStorage): Promise<Theme> => {
  return storage.get<SavedTheme>(themeKey, []).then((saved) => {
    return defaultTheme.map((themeItem) => {
      const savedThemeItem = saved?.find(({ label }) => themeItem.label === label);

      // Only the color is taken from storage. Spreading the whole saved item would let a stale or
      // hand-edited value in the config issue override `backgroundCssVar`, `group`, or the
      // description — and `group` decides whether an entry shows up in the report's status legend.
      if (savedThemeItem?.backgroundColor) {
        return { ...themeItem, backgroundColor: savedThemeItem.backgroundColor };
      }

      return themeItem;
    });
  });
};

export const updateTheme = (storage: AppStorage, updates: Theme): Promise<void> => {
  return storage.update(
    themeKey,
    updates.map(({ label, backgroundColor }) => ({ label, backgroundColor })),
  );
};
