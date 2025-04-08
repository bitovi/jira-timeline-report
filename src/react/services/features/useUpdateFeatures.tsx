import React from "react";
import { useMutation } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

import { Features, updateFeatures } from "../../../jira/features";
import { useStorage } from "../storage";

export const useUpdateFeatures = () => {
  const storage = useStorage();
  const { showFlag } = useFlags();

  const { mutate, isPending } = useMutation({
    mutationFn: (updates: Features) => updateFeatures(storage, updates),
    onSuccess: () => {
      window.location.reload();
    },
    onError: (error) => {
      let description = error?.message;

      if (!description) {
        description = "Something went wrong";
      }

      console.error(
        ["useUpdateFeatures", "Something went wrong updating the app features", description].join(
          "\n"
        ),
        error
      );

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });
    },
  });

  return { update: mutate, isUpdating: isPending };
};
