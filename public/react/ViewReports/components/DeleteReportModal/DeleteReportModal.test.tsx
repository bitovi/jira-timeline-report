import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, it, vi } from "vitest";

import DeleteReportModal from "./DeleteReportModal";

describe("ViewReports Component", () => {
  it("renders without crashing", async () => {
    render(
      <DeleteReportModal
        isOpen
        closeModal={vi.fn()}
        isDeleting={false}
        deleteReport={vi.fn()}
        report={{ name: "Report", id: "1", queryParams: "?param=value" }}
      />
    );

    expect(screen.getByText("Report to be deleted")).toBeInTheDocument();
    expect(screen.getByText("Are you sure you want to delete this report?")).toBeInTheDocument();
    expect(screen.getByText("Cancel")).toBeInTheDocument();
    expect(screen.getByText("Delete report")).toBeInTheDocument();
  });
});
