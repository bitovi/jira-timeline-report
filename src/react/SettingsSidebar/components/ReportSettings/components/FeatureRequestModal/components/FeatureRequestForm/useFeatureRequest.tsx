import React from "react";
import { captureFeedback } from "@sentry/react";
import { useMutation } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import SuccessIcon from "@atlaskit/icon/core/success";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

const createUnsupportedReportFeedback = async ({
  files,
  email,
  description,
}: {
  files: File[];
  email: string;
  description: string;
}) => {
  const formattedFiles = await Promise.all(
    files.map(async (file) => {
      const buffer = await file.arrayBuffer();
      return {
        data: new Uint8Array(buffer),
        filename: file.name,
      };
    })
  );

  return captureFeedback(
    {
      email,
      message: description,
    },
    {
      captureContext: {
        tags: { type: "feature-request" },
      },
      attachments: formattedFiles,
    }
  );
};

export const useFeatureRequest = () => {
  const { showFlag } = useFlags();

  const {
    mutate: submitFeatureRequest,
    isPending: isSubmitting,
    error,
  } = useMutation({
    mutationFn: createUnsupportedReportFeedback,
    onSuccess: () => {
      showFlag({
        title: <Text color="color.text.success">Success</Text>,
        description: `Thanks for the feature request!`,
        isAutoDismiss: true,
        icon: <SuccessIcon color={token("color.icon.success")} label="success" />,
      });
    },
  });

  return {
    submitFeatureRequest,
    isSubmitting,
    error,
  };
};
