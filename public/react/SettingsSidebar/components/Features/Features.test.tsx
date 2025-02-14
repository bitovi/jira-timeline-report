import React from "react";
import { render, screen } from "@testing-library/react";

import Features from "./Features";

const features = [
  { title: "Scatter Timeline Plot", subtitle: "Report due dates in a condensed scatter plot" },
  { title: "Estimation Table", subtitle: "" },
  { title: "Secondary Report", subtitle: "" },
  { title: "Work Breakdowns", subtitle: "" },
];

describe("<Features />", () => {
  it("renders without crashing", () => {
    render(<Features />);

    const heading = screen.getByText("Features");
    expect(heading).toBeInTheDocument();

    const description = screen.getByText(/turn on new features under active development/i);
    expect(description).toBeInTheDocument();

    features.forEach((feature) => {
      const featureText = screen.getByText(feature.title);

      expect(featureText).toBeInTheDocument();
    });

    const feedbackText = screen.getByText(/got feedback\?/i);
    expect(feedbackText).toBeInTheDocument();

    const feedbackLink = screen.getByRole("link", { name: /let us know on github/i });
    expect(feedbackLink).toBeInTheDocument();
  });
});
