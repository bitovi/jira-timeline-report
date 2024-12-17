import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useFlags } from "@atlaskit/flag";

import type { Report, Reports } from "../../../jira/reports";
import { updateReports } from "../../../jira/reports";
import { useStorage } from "../../services/storage";
import { reportKeys } from "./key-factory";
import { errorHeader, errorIcon, successHeader, successIcon } from "../../../shared/messaging";

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
        title: errorHeader(),
        description,
        isAutoDismiss: true,
        icon: errorIcon,
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
        title: errorHeader(),
        description: `Something went wrong trying to save "${newReport.name}"`,
        isAutoDismiss: true,
        icon: errorIcon,
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
            title: successHeader(),
            description: `Successfully created report: "${newReport.name}"`,
            isAutoDismiss: true,
            icon: successIcon,
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
        title: errorHeader(),
        description: "Something went wrong trying to update the report",
        isAutoDismiss: true,
        icon: errorIcon,
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
            title: successHeader(),
            description: `Successfully updated report: "${newReport.name}"`,
            isAutoDismiss: true,
            icon: successIcon,
          });
        },
      }
    );
  };

  return { updateReport, isUpdating: isPending };
};
