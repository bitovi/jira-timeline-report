import { applyThemeToCssVars, updateTheme, type Theme } from '../../../jira/theme';

import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useFlags } from '@atlaskit/flag';
import ErrorIcon from '@atlaskit/icon/core/error';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';

import { useStorage } from '../../services/storage';
import { themeKeys } from './key-factory';

interface UseSaveThemeConfig {
  /**
   * Called with the last known-good theme when a save fails, after the cache and the page's CSS
   * variables have been put back. A panel holding its own working copy for live preview needs to
   * follow that rollback, and this hook is the only place that knows what to roll back to.
   */
  onRollback?: (previous: Theme) => void;
}

export const useSaveTheme = ({ onRollback }: UseSaveThemeConfig = {}) => {
  const storage = useStorage();
  const queryClient = useQueryClient();
  const { showFlag } = useFlags();

  const { mutate: save, isPending } = useMutation({
    mutationFn: (toSave: Theme) => {
      return updateTheme(storage, toSave);
    },
    onMutate: async (toSave) => {
      await queryClient.cancelQueries({ queryKey: themeKeys.theme });

      const previousTheme = queryClient.getQueryData<Theme>(themeKeys.theme);
      queryClient.setQueryData<Theme>(themeKeys.theme, toSave);

      return { previousTheme };
    },
    /**
     * Deliberately no `onSettled` refetch. The theme is written with `PUT /rest/api/3/issue/:id` but
     * read back through `/search/jql`, which serves Jira's search index — that index lags the write
     * by seconds, so re-reading here routinely returns the pre-write colors. The optimistic value
     * from `onMutate` is the better answer on success; only a failure needs the truth from Jira.
     */
    onError: (error, _, context) => {
      queryClient.setQueryData<Theme>(themeKeys.theme, context?.previousTheme);
      applyThemeToCssVars(context?.previousTheme);

      if (context?.previousTheme) {
        onRollback?.(context.previousTheme);
      }

      // Only on failure: the cache now holds a value that was never persisted, so it has to be
      // reconciled against Jira rather than trusted.
      queryClient.invalidateQueries({ queryKey: themeKeys.theme });

      let description = error?.message;

      if (!description) {
        description = 'Something went wrong';
      }

      console.error(['useSaveTheme', 'Something went wrong updating the theme', description].join('\n'), error);

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
