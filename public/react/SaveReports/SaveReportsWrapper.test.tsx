import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import SaveReportsWrapper from "./SaveReportsWrapper";

const mockOnViewReportsButtonClicked = vi.fn();

describe("<SaveReportsWrapper />", () => {
  it("renders without crashing", async () => {
    render(
      <SaveReportsWrapper
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{ on: vi.fn(), off: vi.fn(), value: "", set: vi.fn() }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Saved Reports")).toBeInTheDocument();
    });

    expect(screen.queryByText("Create new report")).not.toBeInTheDocument();
  });

  it("shows the create report button if jql is present", async () => {
    render(
      <SaveReportsWrapper
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          value: "?jql=issues-and-what-not",
          set: vi.fn(),
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Saved Reports")).toBeInTheDocument();
      expect(screen.getByText("Create new report")).toBeInTheDocument();
    });
  });
});
