import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";
import SuccessIcon from "@atlaskit/icon/core/success";
import ErrorIcon from "@atlaskit/icon/core/error";
import { Text } from "@atlaskit/primitives";
import { token } from "@atlaskit/tokens";

import type { Report, Reports } from "../../../jira/reports";
import { updateReports } from "../../../jira/reports";
import { useStorage } from "../../services/storage";
import { reportKeys } from "./key-factory";

const useSaveReport = () => {
  const storage = useStorage();
  const queryClient = useQueryClient();
  const { showFlag } = useFlags();

  const { mutate: save, isPending } = useMutation({
    mutationFn: (toSave: Reports) => {
      return updateReports(storage, toSave);
    },
    onMutate: async (toSave) => {
      await queryClient.cancelQueries({ queryKey: reportKeys.allReports });

      const previousReports = queryClient.getQueryData<Reports>(reportKeys.allReports);
      queryClient.setQueryData<Reports>(reportKeys.allReports, toSave);

      return { previousReports };
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.allReports });
    },
    onError: (error, _, context) => {
      queryClient.setQueryData<Reports>(reportKeys.allReports, context?.previousReports);

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

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  const { save, isPending } = useSaveReport();
  const { showFlag } = useFlags();

  const createReport = (newReport: Report, options?: Parameters<typeof save>[1]) => {
    const allReports = queryClient.getQueryData<Reports>(reportKeys.allReports);

    if (!allReports) {
      console.warn(
        [
          "Tried to create a report without fetching the reports.",
          `Attempted to retrieve ${reportKeys.allReports} from the cache and it wasn't there`,
        ].join("\n")
      );

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description: `Something went wrong trying to save "${newReport.name}"`,
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });

      return;
    }

    save(
      { ...allReports, [newReport.id]: newReport },
      {
        ...(options ?? {}),
        onSuccess: (...args) => {
          options?.onSuccess?.(...args);

          showFlag({
            title: <Text color="color.text.success">Success</Text>,
            description: `Successfully created report: "${newReport.name}"`,
            isAutoDismiss: true,
            icon: <SuccessIcon color={token("color.icon.success")} label="success" />,
          });
        },
      }
    );
  };

  return { createReport, isCreating: isPending };
};

export const useUpdateReport = () => {
  const queryClient = useQueryClient();
  const { save, isPending } = useSaveReport();
  const { showFlag } = useFlags();

  const updateReport = (
    id: Report["id"],
    updates: Partial<Omit<Report, "id">>,
    options?: Parameters<typeof save>[1]
  ) => {
    const allReports = queryClient.getQueryData<Reports>(reportKeys.allReports);

    if (!allReports?.[id]) {
      console.warn(
        [
          "Tried to create a report without fetching the reports.",
          `Attempted to retrieve ${reportKeys.allReports} from the cache and it wasn't there`,
        ].join("\n")
      );

      showFlag({
        title: <Text color="color.text.danger">Uh Oh!</Text>,
        description: "Something went wrong trying to update the report",
        isAutoDismiss: true,
        icon: <ErrorIcon color={token("color.icon.danger")} label="error" />,
      });

      return;
    }

    const newReport = { ...allReports[id], ...updates };

    save(
      { ...allReports, [id]: newReport },
      {
        ...(options ?? {}),
        onSuccess: (...args) => {
          options?.onSuccess?.(...args);

          showFlag({
            title: <Text color="color.text.success">Success</Text>,
            description: `Successfully updated report: "${newReport.name}"`,
            isAutoDismiss: true,
            icon: <SuccessIcon color={token("color.icon.success")} label="success" />,
          });
        },
      }
    );
  };

  return { updateReport, isUpdating: isPending };
};

export const useDeleteReport = () => {
  const queryClient = useQueryClient();
  const { save, isPending } = useSaveReport();
  const { showFlag } = useFlags();

  const deleteReport = (id: Report["id"], options?: Parameters<typeof save>[1]) => {
    const allReports = queryClient.getQueryData<Reports>(reportKeys.allReports);

    if (!allReports?.[id]) {
      console.warn(
        [
          "Tried to create a report without fetching the reports.",
          `Attempted to retrieve ${reportKeys.allReports} from the cache and it wasn't there`,
        ].join("\n")
      );

      showFlag({
        title: "Uh oh!",
        description: "Something went wrong trying to delete the report",
        isAutoDismiss: true,
        icon: <ErrorIcon label="error" />,
      });

      return;
    }

    const newReports = structuredClone(allReports);
    const report = newReports[id];

    if (!report) {
      console.warn(`Tried to delete ${id} but it didn't exist`);
      return;
    }

    delete newReports[id];

    save(newReports, {
      ...(options ?? {}),
      onSuccess: (...args) => {
        options?.onSuccess?.(...args);

        showFlag({
          title: "Success",
          description: `Successfully deleted ${report.name}`,
          isAutoDismiss: true,
          icon: <SuccessIcon label="success" />,
        });
      },
    });
  };

  return { deleteReport, isDeleting: isPending };
};
