import type { AppStorage } from "../../jira/storage/common";
import type { ComponentProps } from "react";

import React, { Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { FlagsProvider } from "@atlaskit/flag";
import userEvent from "@testing-library/user-event";

import ViewReports from "./ViewReports";
import { StorageProvider } from "../services/storage";

type OverrideStorage = Omit<AppStorage, "get"> & {
  get: (key: string) => any;
};

type RenderConfig = {
  props: ComponentProps<typeof ViewReports>;
  storage: Partial<OverrideStorage>;
};

async function get<T>(key: string): Promise<T | null> {
  return null;
}

async function update<T>(key: string, updates: T): Promise<void> {}

const renderWithWrappers = (config?: Partial<RenderConfig>) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const { props, storage }: RenderConfig = {
    props: { onBackButtonClicked: vi.fn(), ...(config?.props ?? {}) },
    storage: {
      get,
      update,
      storageInitialized: async () => true,
      ...(config?.storage ?? {}),
    },
  };

  return render(
    <Suspense fallback="loading">
      <FlagsProvider>
        <StorageProvider storage={storage as ComponentProps<typeof StorageProvider>["storage"]}>
          <QueryClientProvider client={queryClient}>
            <ViewReports {...props} />
          </QueryClientProvider>
        </StorageProvider>
      </FlagsProvider>
    </Suspense>
  );
};

describe("ViewReports Component", () => {
  it("renders without crashing", async () => {
    renderWithWrappers({
      storage: {
        get: async () => {
          return {
            "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
            "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
          };
        },
      },
    });

    const backButton = await screen.findByText("Back to report");
    const title = await screen.findByText("Saved Reports");
    const manageHeading = await screen.findByText("Manage");
    const reportHeading = await screen.findByText("Report");
    const report = await screen.findByText("Report name Report 1");

    expect(backButton).toBeInTheDocument();
    expect(manageHeading).toBeInTheDocument();
    expect(reportHeading).toBeInTheDocument();
    expect(title).toBeInTheDocument();
    expect(report).toBeInTheDocument();
  });

  it("renders reports in the table", async () => {
    renderWithWrappers({
      storage: {
        get: async () => {
          return {
            "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
            "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
          };
        },
      },
    });

    expect(await screen.findByText("Report name Report 1")).toBeInTheDocument();
    expect(await screen.findByText("Report name Report 2")).toBeInTheDocument();
  });

  it("renders the selected report's name in the reportInfo section", async () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { search: "?report=1" },
    });

    renderWithWrappers({
      storage: {
        get: async () => {
          return {
            "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
            "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
          };
        },
      },
    });

    expect(await screen.findByText("Report 1")).toBeInTheDocument();
  });

  it("deletes report", async () => {
    const mockUpdate = vi.fn();

    renderWithWrappers({
      storage: {
        get: async () => {
          return {
            "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
            "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
          };
        },
        update: async (...args) => mockUpdate(...args),
      },
    });

    const manage = await screen.findByText(`manage report, Report 1`);

    userEvent.click(manage);

    const deleteButton = await screen.findByText("Delete");

    userEvent.click(deleteButton);

    expect(await screen.findByText("Report 1 to be deleted")).toBeInTheDocument();
    expect(
      await screen.findByText("Are you sure you want to delete this report?")
    ).toBeInTheDocument();

    expect(await screen.findByText("Cancel")).toBeInTheDocument();

    userEvent.click(await screen.findByText("Delete report"));

    await waitFor(() =>
      expect(mockUpdate).toHaveBeenLastCalledWith("saved-reports", {
        "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
      })
    );
  });
});
