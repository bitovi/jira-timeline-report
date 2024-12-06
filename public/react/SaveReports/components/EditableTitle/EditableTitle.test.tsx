import React from "react";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi, beforeEach } from "vitest";

import EditableTitle from "./EditableTitle";

const mockValidate = vi.fn();
const mockSetName = vi.fn();
const mockUpdateReport = vi.fn();

vi.mock("../../../services/reports", () => ({
  useUpdateReport: () => ({
    updateReport: mockUpdateReport,
    isUpdating: false,
  }),
}));

describe("<EditableTitle />", () => {
  const selectedReport = { id: "1", name: "Initial Report Name", queryParams: "" };

  beforeEach(() => {
    vi.resetAllMocks();
    mockValidate.mockReturnValue({ isValid: true, message: "" });
  });

  it("renders without crashing", () => {
    render(
      <EditableTitle
        validate={mockValidate}
        selectedReport={selectedReport}
        name="Initial Report Name"
        setName={mockSetName}
      />
    );

    expect(screen.getByRole("heading", { name: /Initial Report Name/i })).toBeInTheDocument();
  });

  it("allows switching to edit mode and shows a text field", async () => {
    render(
      <EditableTitle
        validate={mockValidate}
        selectedReport={selectedReport}
        name="Initial Report Name"
        setName={mockSetName}
      />
    );

    const editButton = screen.getByRole("button", { name: /Initial Report Name/i });
    await userEvent.click(editButton);

    expect(screen.getByRole("textbox")).toBeInTheDocument();
  });

  it("validates input and displays an error message if invalid", async () => {
    mockValidate.mockReturnValueOnce({ isValid: false, message: "Invalid name" });

    render(
      <EditableTitle
        validate={mockValidate}
        selectedReport={selectedReport}
        name="Initial Report Name"
        setName={mockSetName}
      />
    );

    const editButton = screen.getByRole("button", { name: /Initial Report Name/i });
    await userEvent.click(editButton);

    const input = screen.getByRole("textbox");
    await userEvent.type(input, "1");

    expect(mockValidate).toHaveBeenCalledWith("Initial Report Name1");

    expect(screen.getByText("Invalid name")).toBeInTheDocument();
  });

  it("calls updateReport with valid change", async () => {
    render(
      <EditableTitle
        validate={mockValidate}
        selectedReport={selectedReport}
        name="Initial Report Name"
        setName={mockSetName}
      />
    );

    const editButton = screen.getByRole("button", { name: /Initial Report Name/i });
    await userEvent.click(editButton);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "1");

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    await act(() => userEvent.click(confirmButton));

    expect(mockUpdateReport).toHaveBeenCalled();
  });

  it("does not call updateReport when the name is unchanged", async () => {
    render(
      <EditableTitle
        validate={mockValidate}
        selectedReport={selectedReport}
        name="Initial Report Name"
        setName={mockSetName}
      />
    );

    const editButton = screen.getByRole("button", { name: /Initial Report Name/i });
    await userEvent.click(editButton);

    const input = screen.getByRole("textbox");
    await userEvent.clear(input);
    await userEvent.type(input, "Initial Report Name");

    const confirmButton = screen.getByRole("button", { name: /Confirm/i });
    await act(() => userEvent.click(confirmButton));

    expect(mockUpdateReport).not.toHaveBeenCalled();
    expect(mockSetName).not.toHaveBeenCalled();
  });
});
