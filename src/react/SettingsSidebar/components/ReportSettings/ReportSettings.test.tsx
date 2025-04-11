import React from "react";

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import ReportSettings from "./ReportSettings";

describe("ReportSettings Component", () => {
  it("renders without crashing", () => {
    render(<ReportSettings showSidebarBranding changeSettings={vi.fn()} />);

    const reportSettingsHeading = screen.getByText(/report settings/i);
    expect(reportSettingsHeading).toBeInTheDocument();

    const buttons = [/sources/i, /timing/i, /teams/i, /theme/i];

    buttons.forEach((name) => {
      const button = screen.getByRole("button", { name });
      expect(button).toBeInTheDocument();
    });

    const links = [/read the guides/i, /apm training/i, /connect with bitovi/i];

    links.forEach((name) => {
      const link = screen.getByRole("link", { name });
      expect(link).toBeInTheDocument();
    });
  });
});
