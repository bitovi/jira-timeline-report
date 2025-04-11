import React from "react";
import { render, screen } from "@testing-library/react";

import Branding from "./Branding";

describe("Branding Component", () => {
  it("renders without crashing", () => {
    render(<Branding />);

    const image = screen.getByRole("img");
    expect(image).toBeInTheDocument();

    const statusReportsLink = screen.getByRole("link", { name: /status reports/i });
    expect(statusReportsLink).toBeInTheDocument();

    const bitoviLink = screen.getByRole("link", { name: /by bitovi/i });
    expect(bitoviLink).toBeInTheDocument();
  });
});
