import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import { value } from "../../can";

import SaveReportsWrapper from "./SaveReportsWrapper";
import { CanObservable } from "../hooks/useCanObservable";

const mockOnViewReportsButtonClicked = vi.fn();

const loggedInObservable = {
  on: vi.fn(),
  off: vi.fn(),
  getData: vi.fn(),
  value: true,
  set: vi.fn(),
};

describe("<SaveReportsWrapper />", () => {
  it("doesn't render if not logged in", () => {
    render(
      <SaveReportsWrapper
        shouldShowReportsObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: true,
          set: vi.fn(),
        }}
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: "",
          set: vi.fn(),
        }}
      />
    );

    expect(screen.queryByText("Saved reports")).not.toBeInTheDocument();
  });

  it("renders without crashing", async () => {
    render(
      <SaveReportsWrapper
        shouldShowReportsObservable={loggedInObservable}
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: "",
          set: vi.fn(),
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Saved reports")).toBeInTheDocument();
    });

    expect(screen.queryByText("Create new report")).not.toBeInTheDocument();
  });

  it("shows the create report button if jql is present", async () => {
    render(
      <SaveReportsWrapper
        shouldShowReportsObservable={loggedInObservable}
        storage={{
          get: vi.fn().mockResolvedValue({ "saved-reports": {} }),
          storageInitialized: async () => true,
          update: vi.fn(),
        }}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        queryParamObservable={{
          on: vi.fn(),
          off: vi.fn(),
          getData: vi.fn(),
          value: "?jql=issues-and-what-not",
          set: vi.fn(),
        }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Saved reports")).toBeInTheDocument();
      expect(screen.getByText("Create new report")).toBeInTheDocument();
    });
  });
});
