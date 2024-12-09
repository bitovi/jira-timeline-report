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
        queryParamObservable={{ on: vi.fn(), off: vi.fn(), getData: vi.fn(), value: "" }}
      />
    );

    await waitFor(() => {
      expect(screen.getByText("Create new report")).toBeInTheDocument();
    });
  });
});
