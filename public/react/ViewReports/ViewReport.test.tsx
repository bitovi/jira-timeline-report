import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, vi, beforeEach, Mock } from "vitest";
import ViewReports from "./ViewReports";
import { useAllReports } from "../services/reports";

vi.mock("../services/reports");

describe("ViewReports Component", () => {
  const mockOnBackButtonClicked = vi.fn();

  beforeEach(() => {
    vi.resetAllMocks();

    (useAllReports as Mock).mockReturnValue({
      "1": { id: "1", name: "Report 1", queryParams: "param1=value1" },
      "2": { id: "2", name: "Report 2", queryParams: "param2=value2" },
    });
  });

  it("renders without crashing ", () => {
    render(<ViewReports onBackButtonClicked={mockOnBackButtonClicked} />);

    expect(screen.getByText("Back to report")).toBeInTheDocument();
    expect(screen.getByText("Saved Reports")).toBeInTheDocument();
    expect(screen.getByText("Report")).toBeInTheDocument();
  });

  it("renders reports in the table", () => {
    render(<ViewReports onBackButtonClicked={mockOnBackButtonClicked} />);

    expect(screen.getByText("Report name Report 1")).toBeInTheDocument();
    expect(screen.getByText("Report name Report 2")).toBeInTheDocument();
  });

  it("renders the selected report's name in the reportInfo section", () => {
    Object.defineProperty(window, "location", {
      writable: true,
      value: { search: "?report=1" },
    });

    render(<ViewReports onBackButtonClicked={mockOnBackButtonClicked} />);

    expect(screen.getByText("Report 1")).toBeInTheDocument();
  });
});
