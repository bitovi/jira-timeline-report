import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import SaveReportsWrapper from "./SaveReportsWrapper";
import { pushStateObservable } from "@routing-observable";

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
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Saved Reports")).toBeInTheDocument();
    });

    expect(screen.queryByText("Create new report")).not.toBeInTheDocument();
  });

  it("shows the create report button if jql is present", async () => {
    pushStateObservable.set("?jql=issues-and-what-not");
    render(
      <SaveReportsWrapper
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
      />,
    );

    await waitFor(() => {
      expect(screen.getByText("Saved Reports")).toBeInTheDocument();
      expect(screen.getByText("Create new report")).toBeInTheDocument();
    });
  });
});
