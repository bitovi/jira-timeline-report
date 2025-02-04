import React from "react";
import { render, screen } from "@testing-library/react";
import { vi } from "vitest";
import userEvent from "@testing-library/user-event";

import { GoBackButton } from "./GoBackButton";

describe("GoBackButton Component", () => {
  it("renders without crashing", () => {
    render(<GoBackButton hideSettings={vi.fn()} />);

    const goBackButton = screen.getByRole("button", { name: /go back/i });
    expect(goBackButton).toBeInTheDocument();
  });

  it("calls hideSettings when the button is clicked", async () => {
    const hideSettingsMock = vi.fn();

    render(<GoBackButton hideSettings={hideSettingsMock} />);

    const goBackButton = screen.getByRole("button", { name: /go back/i });

    await userEvent.click(goBackButton);

    expect(hideSettingsMock).toHaveBeenCalledTimes(1);
  });
});
