import React, { ComponentProps, Suspense } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi, beforeEach, Mock } from "vitest";
import ViewReports from "./ViewReports";
import { useAllReports } from "../services/reports";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StorageProvider } from "../services/storage";
import { FlagsProvider } from "@atlaskit/flag";

type RenderConfig = {
  props: ComponentProps<typeof ViewReports>;
  storage: Partial<
    {
      get: (key: string) => any;
    } & Omit<ComponentProps<typeof StorageProvider>["storage"], "get">
  >;
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
    const report = await screen.findByText(/Report 1/);

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
});
