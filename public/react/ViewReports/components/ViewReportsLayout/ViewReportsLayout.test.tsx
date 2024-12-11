import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import ViewReportsLayout from "./ViewReportsLayout";

describe("<ViewReportsLayout />", () => {
  const mockOnBackButtonClicked = vi.fn();

  it("renders without crashing with minimal props", () => {
    render(<ViewReportsLayout onBackButtonClicked={mockOnBackButtonClicked} />);

    expect(screen.getByText("Back to report")).toBeInTheDocument();
    expect(screen.getByText("Saved Reports")).toBeInTheDocument();
  });

  it("renders reportInfo and children when provided", () => {
    render(
      <ViewReportsLayout onBackButtonClicked={mockOnBackButtonClicked} reportInfo={<span>Report Info</span>}>
        <div>Child Content</div>
      </ViewReportsLayout>
    );

    expect(screen.getByText("Report Info")).toBeInTheDocument();

    expect(screen.getByText("Child Content")).toBeInTheDocument();
  });
});
