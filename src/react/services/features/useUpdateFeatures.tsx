import React from 'react';
import { useMutation } from '@tanstack/react-query';
import { useFlags } from '@atlaskit/flag';
import ErrorIcon from '@atlaskit/icon/core/error';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';

import { FeatureFlags, updateFeatures } from '../../../jira/features';
import { reloadApp } from '../../../shared/reload-app';
import { useStorage } from '../storage';

export const useUpdateFeatures = () => {
  const storage = useStorage();
  const { showFlag } = useFlags();

  const { mutate, isPending } = useMutation({
    mutationFn: (updates: FeatureFlags) => updateFeatures(storage, updates),
    onSuccess: () => {
      // Not `window.location.reload()`: on Forge that reloads the Custom UI iframe out from under
      // its bridge handshake and the app comes back hung. See `shared/reload-app.ts`.
      reloadApp();
    },
    onError: (error) => {
      let description = error?.message;

      if (!description) {
        description = 'Something went wrong';
      }

      console.error(
        ['useUpdateFeatures', 'Something went wrong updating the app features', description].join('\n'),
        error,
      );

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token('color.icon.danger')} label="error" />,
      });
    },
  });

  return { update: mutate, isUpdating: isPending };
};
