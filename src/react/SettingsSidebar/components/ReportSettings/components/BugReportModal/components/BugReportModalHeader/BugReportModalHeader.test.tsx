import React from "react";
import { render, screen } from "@testing-library/react";
import { vi, describe, expect, it } from "vitest";
import BugReportModalHeader from "./BugReportModalHeader";
import Modal from "@atlaskit/modal-dialog";

describe("<BugReportModalHeader />", () => {
  it("renders", () => {
    const mockOnClose = vi.fn();

    render(<BugReportModalHeader onClose={mockOnClose} />, {
      wrapper: ({ children }) => <Modal>{children}</Modal>,
    });

    const title = screen.getByText(/Report a bug/i);
    expect(title).toBeInTheDocument();

    screen.getByRole("button", { name: /close modal/i }).click();
    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });
});
