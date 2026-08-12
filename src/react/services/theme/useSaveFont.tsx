import { applyFontToCssVars, updateFont, type FontSetting } from '../../../jira/theme';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFlags } from '@atlaskit/flag';
import ErrorIcon from '@atlaskit/icon/core/error';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';

import { useStorage } from '../../services/storage';
import { themeKeys } from './key-factory';

interface UseSaveFontConfig {
  /** See `useSaveTheme` — lets the panel's working copy follow a failed save's rollback. */
  onRollback?: (previous: FontSetting) => void;
}

export const useSaveFont = ({ onRollback }: UseSaveFontConfig = {}) => {
  const storage = useStorage();
  const queryClient = useQueryClient();
  const { showFlag } = useFlags();

  const { mutate: save, isPending } = useMutation({
    mutationFn: (toSave: FontSetting) => {
      return updateFont(storage, toSave);
    },
    onMutate: async (toSave) => {
      await queryClient.cancelQueries({ queryKey: themeKeys.font });

      const previousFont = queryClient.getQueryData<FontSetting>(themeKeys.font);
      queryClient.setQueryData<FontSetting>(themeKeys.font, toSave);

      return { previousFont };
    },
    // No `onSettled` refetch, for the same reason as `useSaveTheme`: the write goes to the issue,
    // the read comes from Jira's search index, and the index lags.
    onError: (error, _, context) => {
      queryClient.setQueryData<FontSetting>(themeKeys.font, context?.previousFont);
      // Reverts the DOM too, not just the cache — the panel applies the font optimistically for
      // live preview, so without this a failed save leaves the page showing a font nobody has.
      applyFontToCssVars(context?.previousFont);

      if (context?.previousFont) {
        onRollback?.(context.previousFont);
      }

      queryClient.invalidateQueries({ queryKey: themeKeys.font });

      let description = error?.message;

      if (!description) {
        description = 'Something went wrong';
      }

      console.error(['useSaveFont', 'Something went wrong updating the font', description].join('\n'), error);

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token('color.icon.danger')} label="error" />,
      });
    },
  });

  return { save, isPending };
};
