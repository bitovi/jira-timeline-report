import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { describe, it, vi, beforeEach } from "vitest";

import SavedReportDropdown from "./SavedReportDropdown";
import userEvent from "@testing-library/user-event";

const mockOnViewReportsButtonClicked = vi.fn();

const mockReports = {
  "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
  "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
  "3": { id: "3", name: "Report 3", queryParams: "param3=value3" },
};

describe("<SavedReportDropdown />", () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.resetAllMocks();

    originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "",
        assign: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  it("renders without crashing", async () => {
    render(
      <SavedReportDropdown
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        recentReports={[]}
        reports={{}}
      />
    );

    expect(screen.getByText("Saved Reports")).toBeInTheDocument();
  });

  it("renders the empty view when no reports are available", async () => {
    render(
      <SavedReportDropdown
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        recentReports={[]}
        reports={{}}
      />
    );

    await userEvent.click(screen.getByText("Saved Reports"));

    await waitFor(() => {
      expect(screen.getByText("You don't have any saved reports")).toBeInTheDocument();
    });
  });

  it("renders the recent reports list when reports are available", async () => {
    render(
      <SavedReportDropdown
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        recentReports={["1", "2"]}
        reports={mockReports}
      />
    );

    await userEvent.click(screen.getByText("Saved Reports"));

    expect(screen.getByText("Report 1")).toBeInTheDocument();
    expect(screen.getByText("Report 2")).toBeInTheDocument();
  });

  it("reconciles recent reports with all reports", async () => {
    render(
      <SavedReportDropdown
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        recentReports={["1"]}
        reports={mockReports}
      />
    );

    await userEvent.click(screen.getByText("Saved Reports"));

    await waitFor(() => {
      expect(screen.getByText("Report 1")).toBeInTheDocument();
      expect(screen.getByText("Report 2")).toBeInTheDocument();
      expect(screen.getByText("Report 3")).toBeInTheDocument();
    });
  });

  it("calls the view reports callback when 'View all saved reports' is clicked", async () => {
    render(
      <SavedReportDropdown
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        recentReports={["1"]}
        reports={mockReports}
      />
    );

    await userEvent.click(screen.getByText("Saved Reports"));
    await userEvent.click(screen.getByText("View all saved reports"));

    await waitFor(() => {
      expect(mockOnViewReportsButtonClicked).toHaveBeenCalled();
    });
  });
});
