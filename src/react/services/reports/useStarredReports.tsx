import React, { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useFlags } from '@atlaskit/flag';
import ErrorIcon from '@atlaskit/icon/core/error';
import StarStarredIcon from '@atlaskit/icon/core/star-starred';
import StarUnstarredIcon from '@atlaskit/icon/core/star-unstarred';
import { Text } from '@atlaskit/primitives';
import { token } from '@atlaskit/tokens';

import { useUserServices } from '../user/UserServicesProvider';
import { reportKeys } from './key-factory';

export interface StarredReports {
  starredIds: Set<string>;
  /** The read has settled (either way). Until then every report shows unstarred. */
  isLoaded: boolean;
  /** Stars or unstars, optimistically, with a toast. `name` is only for the toast. */
  toggleStar: (id: string, name?: string) => void;
  /** Quietly drops a star — e.g. after the report is deleted. */
  removeStar: (id: string) => void;
}

const EMPTY: string[] = [];

/**
 * The current user's starred saved reports, from whichever `StarsStore` the host provided (KVS on
 * Forge, localStorage on the web). Non-suspending: until the read lands everything shows unstarred.
 *
 * Writes the whole list each time — it is one small per-user value, and the store has no partial
 * update. The cache is updated first and rolled back on failure, so a click feels instant. A failed
 * read is not retried on a loop and blocks writes (see `canWrite`).
 */
export const useStarredReports = (): StarredReports => {
  const { starsStore } = useUserServices();
  const queryClient = useQueryClient();
  const { showFlag } = useFlags();

  const {
    data = EMPTY,
    isSuccess,
    isError,
  } = useQuery({
    queryKey: reportKeys.starred,
    queryFn: () => starsStore.read(),
    staleTime: Infinity,
    retry: 1,
  });

  const { mutate } = useMutation({
    mutationFn: (ids: string[]) => starsStore.write(ids),
    onMutate: async (ids: string[]) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.starred });

      const previous = queryClient.getQueryData<string[]>(reportKeys.starred);
      queryClient.setQueryData(reportKeys.starred, ids);

      return { previous };
    },
    onError: (error, _ids, context) => {
      queryClient.setQueryData(reportKeys.starred, context?.previous);

      console.error('Could not save starred reports', error);

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description: 'Could not update your starred reports',
        isAutoDismiss: true,
        icon: <ErrorIcon color={token('color.icon.danger')} label="error" />,
      });
    },
  });

  const starredIds = useMemo(() => new Set(data), [data]);

  /** The latest list, read from the cache so two quick clicks don't both start from a stale render. */
  const current = () => queryClient.getQueryData<string[]>(reportKeys.starred) ?? data;

  /**
   * Every write replaces the whole list, so writing before the read has landed — or after it failed
   * — would replace the user's real stars with just this one. Refuse instead.
   */
  const canWrite = (): boolean => {
    if (isSuccess) {
      return true;
    }

    showFlag({
      title: <Text color="color.text.danger">Uh Oh!</Text>,
      description: isError ? 'Your starred reports could not be loaded' : 'Your starred reports are still loading',
      isAutoDismiss: true,
      icon: <ErrorIcon color={token('color.icon.danger')} label="error" />,
    });

    return false;
  };

  const toggleStar = (id: string, name?: string) => {
    if (!canWrite()) {
      return;
    }

    const ids = current();
    const isStarred = ids.includes(id);

    mutate(isStarred ? ids.filter((starred) => starred !== id) : [...ids, id], {
      onSuccess: () => {
        showFlag({
          title: isStarred ? 'Removed from starred' : 'Added to starred',
          description: name ? `"${name}"` : undefined,
          isAutoDismiss: true,
          icon: isStarred ? (
            <StarUnstarredIcon label="" />
          ) : (
            <StarStarredIcon label="" color={token('color.icon.accent.yellow', '#E2B203')} />
          ),
        });
      },
    });
  };

  const removeStar = (id: string) => {
    // Quiet: nothing to clean up in a list that never loaded.
    if (!isSuccess) {
      return;
    }

    const ids = current();

    if (ids.includes(id)) {
      mutate(ids.filter((starred) => starred !== id));
    }
  };

  return { starredIds, isLoaded: isSuccess || isError, toggleStar, removeStar };
};
