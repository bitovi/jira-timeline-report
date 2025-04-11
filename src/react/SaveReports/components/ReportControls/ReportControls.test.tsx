import React from "react";
import { render, screen } from "@testing-library/react";

import ReportControls from "./ReportControls";

const COPY_TEXT = "Copy report";
const SAVE_TEXT = "Save report";
const RESET_TEXT = "Reset changes";

it("should show nothing if no report is selected", () => {
  render(<ReportControls hasSelectedReport={false} />);

  expect(screen.queryByText(COPY_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(SAVE_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(RESET_TEXT)).not.toBeInTheDocument();
});

it("should show copy button if not dirty", () => {
  render(<ReportControls hasSelectedReport={true} isDirty={false} />);

  expect(screen.queryByText(COPY_TEXT)).toBeInTheDocument();
  expect(screen.queryByText(SAVE_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(RESET_TEXT)).not.toBeInTheDocument();
});

it("should show reset button if dirty", () => {
  render(<ReportControls hasSelectedReport={true} isDirty={true} />);

  expect(screen.queryByText(COPY_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(RESET_TEXT)).toBeInTheDocument();
});

it("should show save button if dirty", () => {
  render(<ReportControls hasSelectedReport={true} isDirty={true} />);

  expect(screen.queryByText(COPY_TEXT)).not.toBeInTheDocument();
  expect(screen.queryByText(SAVE_TEXT)).toBeInTheDocument();
});
