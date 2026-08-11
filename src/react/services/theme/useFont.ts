import type { FontSetting } from '../../../jira/theme';

import { useSuspenseQuery } from '@tanstack/react-query';

import { useStorage } from '../../services/storage';
import { themeKeys } from './key-factory';
import { getFont } from '../../../jira/theme';

export type UseFont = () => FontSetting;

export const useFont: UseFont = () => {
  const storage = useStorage();

  const { data } = useSuspenseQuery({
    queryKey: themeKeys.font,
    queryFn: async () => {
      const font = await getFont(storage);

      return font;
    },
  });

  return data;
};
