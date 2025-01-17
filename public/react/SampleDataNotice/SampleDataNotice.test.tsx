import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, vi } from "vitest";

import SampleDataNotice from "./SampleDataNotice";

describe("<SampleDataNotice />", () => {
  it("renders without crashing", () => {
    render(
      <SampleDataNotice
        onLoginClicked={vi.fn()}
        shouldHideNoticeObservable={{
          getData: () => false,
          value: false,
          on: vi.fn(),
          off: vi.fn(),
          set: vi.fn(),
        }}
      />
    );

    expect(
      screen.getByText(/Welcome! You're currently viewing a sample report/i)
    ).toBeInTheDocument();

    expect(screen.getByText(/Release end dates with initiative status/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Release timeline with initiative work breakdown/i)
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Ready and in-development initiative work breakdown/i)
    ).toBeInTheDocument();
  });

  it("does not render when shouldHideNotice is true", () => {
    render(
      <SampleDataNotice
        onLoginClicked={vi.fn()}
        shouldHideNoticeObservable={{
          getData: () => true,
          value: true,
          on: vi.fn(),
          off: vi.fn(),
          set: vi.fn(),
        }}
      />
    );

    expect(
      screen.queryByText(/Welcome! You're currently viewing a sample report/i)
    ).not.toBeInTheDocument();
  });

  it("calls onLoginClicked when 'Connect to Jira' is clicked", async () => {
    const user = userEvent.setup();
    const mockOnLoginClicked = vi.fn();

    render(
      <SampleDataNotice
        onLoginClicked={mockOnLoginClicked}
        shouldHideNoticeObservable={{
          getData: () => false,
          value: false,
          on: vi.fn(),
          off: vi.fn(),
          set: vi.fn(),
        }}
      />
    );

    const connectToJiraLink = screen.getByText(/Connect to Jira/i);
    await user.click(connectToJiraLink);

    expect(mockOnLoginClicked).toHaveBeenCalled();
  });
});
