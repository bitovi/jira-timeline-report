import React from "react";

import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import RecentReports from "./RecentReports";

const mockSetIsOpen = vi.fn();
const mockOnViewReportsButtonClicked = vi.fn();

const mockReports = {
  "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
  "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
};

const recentReports = ["1", "2"];

describe("<RecentReports /> ", () => {
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

  it("renders without crashing", () => {
    render(
      <RecentReports
        recentReports={recentReports}
        reports={mockReports}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        setIsOpen={mockSetIsOpen}
      />
    );

    expect(screen.getByText(/Recent/i)).toBeInTheDocument();
    expect(screen.getByText("Report 1")).toBeInTheDocument();
    expect(screen.getByText("Report 2")).toBeInTheDocument();
    expect(screen.getByText("View all saved reports")).toBeInTheDocument();
  });

  it("navigates to report when a recent report is clicked", () => {
    render(
      <RecentReports
        recentReports={recentReports}
        reports={mockReports}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        setIsOpen={mockSetIsOpen}
      />
    );

    const reportItem = screen.getByText("Report 1");
    fireEvent.click(reportItem);

    expect(window.location.search).toBe("?" + mockReports["1"].queryParams);
  });

  it("handles 'View all saved reports' button click", () => {
    render(
      <RecentReports
        recentReports={recentReports}
        reports={mockReports}
        onViewReportsButtonClicked={mockOnViewReportsButtonClicked}
        setIsOpen={mockSetIsOpen}
      />
    );

    const viewAllButton = screen.getByText("View all saved reports");
    fireEvent.click(viewAllButton);

    expect(mockOnViewReportsButtonClicked).toHaveBeenCalled();
    expect(mockSetIsOpen).toHaveBeenCalledWith(false);
  });
});
