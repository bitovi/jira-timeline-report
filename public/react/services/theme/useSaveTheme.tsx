import { applyThemeToCssVars, updateTheme, type Theme } from "../../../jira/theme";

import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

import { useStorage } from "../../services/storage";
import { themeKeys } from "./key-factory";

export const useSaveTheme = () => {
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

      applyThemeToCssVars(toSave);

      return { previousTheme };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: themeKeys.theme });
    },
    onError: (error, _, context) => {
      queryClient.setQueryData<Theme>(themeKeys.theme, context?.previousTheme);
      applyThemeToCssVars(context?.previousTheme);

      let description = error?.message;

      if (!description) {
        description = "Something went wrong";
      }

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });
    },
  });

  return { save, isPending };
};
