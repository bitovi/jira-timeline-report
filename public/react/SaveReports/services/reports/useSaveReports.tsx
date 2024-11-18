import React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Report, Reports } from "../../../../jira/reports";
import { updateReports } from "../../../../jira/reports";
import { useStorage } from "../../../services/storage";
import { v4 as uuidv4 } from "uuid";

import { useFlags } from "@atlaskit/flag";
import { reportKeys } from "./key-factory";
import ErrorIcon from "@atlaskit/icon/glyph/error";
import SuccessIcon from "@atlaskit/icon/core/success";

const useSaveReport = () => {
  const storage = useStorage();
  const queryClient = useQueryClient();
  const { showFlag } = useFlags();

  const { mutate: save, isPending } = useMutation({
    mutationFn: (toSave: Reports) => {
      return updateReports(storage, toSave);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: reportKeys.allReports });
    },
    onError: (error) => {
      let description = error?.message;

      if (!description) {
        description = "Something went wrong";
      }

      showFlag({
        title: "Uh Oh!",
        description,
        isAutoDismiss: true,
        icon: <ErrorIcon label="error" />,
      });
    },
  });

  return { save, isPending };
};

export const useCreateReport = () => {
  const queryClient = useQueryClient();
  const { save, isPending } = useSaveReport();
  const { showFlag } = useFlags();

  const createReport = (newReport: Omit<Report, "id">, options?: Parameters<typeof save>[1]) => {
    const allReports = queryClient.getQueryData<Reports>(reportKeys.allReports);

    if (!allReports) {
      console.warn(
        [
          "Tried to create a report without fetching the reports.",
          `Attempted to retrieve ${reportKeys.allReports} from the cache and it wasn't there`,
        ].join("\n")
      );

      showFlag({
        title: "Uh oh!",
        description: "Something went wrong trying to save " + name,
        isAutoDismiss: true,
        icon: <ErrorIcon label="error" />,
      });
    }

    const id = uuidv4();

    const urlParams = new URLSearchParams(newReport.queryParams);
    urlParams.append("report", id);

    save(
      { ...allReports, [id]: { id, ...newReport, queryParams: urlParams.toString() } },
      {
        ...(options ?? {}),
        onSuccess: (...args) => {
          options?.onSuccess?.(...args);

          console.log(urlParams.toString());
          window.location.search = urlParams.toString();

          showFlag({
            title: "Success",
            description: `Successfully created ${newReport.name}`,
            isAutoDismiss: true,
            icon: <SuccessIcon label="success" />,
          });
        },
      }
    );
  };

  return { createReport, isPending };
};
