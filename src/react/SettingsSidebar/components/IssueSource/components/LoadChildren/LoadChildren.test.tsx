import React from "react";

import { render, screen } from "@testing-library/react";
import { vi } from "vitest";

import LoadChildren from "./LoadChildren";

describe("<LoadChildren />", () => {
  it("renders without crashing", () => {
    render(
      <LoadChildren
        loadChildren={false}
        setLoadChildren={vi.fn()}
        childJql=""
        setChildJql={vi.fn()}
      />
    );

    const loadChildrenCheckbox = screen.getByLabelText(
      /load all children of jql specified issues/i
    );
    expect(loadChildrenCheckbox).toBeInTheDocument();

    const childJqlLabel = screen.queryByLabelText(/optional children jql filters/i);
    expect(childJqlLabel).not.toBeInTheDocument();
  });

  it("shows child JQL input when loadChildren is checked", () => {
    render(
      <LoadChildren
        loadChildren={true}
        setLoadChildren={vi.fn()}
        childJql=""
        setChildJql={vi.fn()}
      />
    );

    const childJqlInput = screen.getByLabelText(/optional children jql filters/i);
    expect(childJqlInput).toBeInTheDocument();
  });
});
