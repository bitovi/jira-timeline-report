import { getTextColorUsingAPCA } from '../../utils/color';
import { AppStorage } from '../storage/common';

export const defaultTheme = [
  {
    label: 'Complete',
    description: `End date in the past`,
    backgroundColor: '#22A06B',
    backgroundCssVar: '--complete-color',
    textCssVar: '--complete-text-color',
  },
  {
    label: 'Blocked',
    description: `Has Jira status of "blocked" or label of "blocked"`,
    backgroundColor: '#E2483D',
    backgroundCssVar: '--blocked-color',
    textCssVar: '--blocked-text-color',
  },
  {
    label: 'Warning',
    description: `Has Jira status of "warning" or label of "warning"`,
    backgroundColor: '#FF8E09',
    backgroundCssVar: '--warning-color',
    textCssVar: '--warning-text-color',
  },
  {
    label: 'New',
    description: `Issue did not exist in "last period"`,
    backgroundColor: '#8F7EE7',
    backgroundCssVar: '--new-color',
    textCssVar: '--new-text-color',
  },
  {
    label: 'Behind',
    description: `End date "today" is later than end date in "last period"`,
    backgroundColor: '#F5CD47',
    backgroundCssVar: '--behind-color',
    textCssVar: '--behind-text-color',
  },
  {
    label: 'Ahead',
    description: `End date "today" is earlier than end date in "last period"`,
    backgroundColor: '#2898BD',
    backgroundCssVar: '--ahead-color',
    textCssVar: '--ahead-text-color',
  },
  {
    label: 'On Track',
    description: `Timing didn't change, starts before now, ends after now`,
    backgroundColor: '#388BFF',
    backgroundCssVar: '--ontrack-color',
    textCssVar: '--ontrack-text-color',
  },
  {
    label: 'Not Started',
    description: `Start date is after now`,
    backgroundColor: '#8590A2',
    backgroundCssVar: '--notstarted-color',
    textCssVar: '--notstarted-text-color',
  },
];

export type Theme = typeof defaultTheme;

type SavedTheme = Array<{ label: string; backgroundColor: string }>;

const themeKey = 'theme';

export const getTheme = (storage: AppStorage): Promise<Theme> => {
  return storage.get<SavedTheme>(themeKey, []).then((saved) => {
    return defaultTheme.map((themeItem) => {
      const savedThemeItem = saved?.find(({ label }) => themeItem.label === label);

      if (savedThemeItem) {
        return { ...themeItem, ...savedThemeItem };
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
