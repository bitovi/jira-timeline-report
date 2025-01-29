import React, { Suspense } from "react";
import { render, screen, within } from "@testing-library/react";
import { describe, it, vi } from "vitest";
import userEvent from "@testing-library/user-event";

import routeData from "../../../canjs/routing/route-data.js";

import { TimingCalculation } from "./TimingCalculation";

vi.mock("../../../canjs/routing/route-data.js", async () => {
  const mockRouteData = {
    simplifiedIssueHierarchy: [
      {
        "self": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10081",
        "id": "10081",
        "description": "",
        "iconUrl": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/2/universal_avatar/view/type/issuetype/avatar/10322?size=medium",
        "name": "Outcome",
        "untranslatedName": "Outcome",
        "subtask": false,
        "avatarId": 10322,
        "hierarchyLevel": 3
      },
      {
        "self": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10041",
        "id": "10041",
        "description": "",
        "iconUrl": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/2/universal_avatar/view/type/issuetype/avatar/10314?size=medium",
        "name": "Initiative",
        "untranslatedName": "Initiative",
        "subtask": false,
        "avatarId": 10314,
        "hierarchyLevel": 2
      },
      {
        "self": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10000",
        "id": "10000",
        "description": "A big user story that needs to be broken down. Created by Jira Software - do not edit or delete.",
        "iconUrl": "https://bitovi-training.atlassian.net/images/icons/issuetypes/epic.svg",
        "name": "Epic",
        "untranslatedName": "Epic",
        "subtask": false,
        "hierarchyLevel": 1
      },
      {
        "self": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/3/issuetype/10004",
        "id": "10004",
        "description": "Functionality or a feature expressed as a user goal.",
        "iconUrl": "https://api.atlassian.com/ex/jira/74eb923a-a968-44b2-8b4c-5b69e7266b8c/rest/api/2/universal_avatar/view/type/issuetype/avatar/10315?size=medium",
        "name": "Story",
        "untranslatedName": "Story",
        "subtask": false,
        "avatarId": 10315,
        "hierarchyLevel": 0
      }
    ],
    timingCalculations: {
      // Outcome using default calculation
      Initiative: "childrenOnly",
      Epic: 'childrenFirstThenParent',
    }
  };
  const { ObservableObject } = await import("../../../can.js");

  return {
    default: new (ObservableObject as ObjectConstructor)(mockRouteData),
    RouteData: (await vi.importActual("../../../canjs/routing/route-data.js")).RouteData
  };
});

const renderWithWrappers = () => {
  return render(
    <Suspense fallback="loading">
      <TimingCalculation />
    </Suspense>
  );
};

describe("TimingCalculation Component", () => {
  it("renders without crashing", async () => {
    renderWithWrappers();

    const title = await screen.findByText("Timing Calculation");
    const levels = [
      await screen.findByText("Outcome"),
      await screen.findByText("Initiative"),
      await screen.findByText("Epic"),
      await screen.findByText("Story"),
    ];
    const calculations = [
      await screen.findByText("↕︎ From Outcome or Initiatives (earliest to latest)"),
      await screen.findByText("↓ From Epics"),
      await screen.findByText("↓↑ From Storys, then Epic"),
    ]

    expect(title).toBeInTheDocument();
    for (const level of levels) {
      expect(level).toBeInTheDocument();
    }
    for (const calculation of calculations) {
      expect(calculation).toBeInTheDocument();
    }
  });

  it("updates with selection", async () => {
    renderWithWrappers();

    const outcome = await screen.findByDisplayValue("↕︎ From Outcome or Initiatives (earliest to latest)");
    await userEvent.selectOptions(outcome, within(outcome).getByText("↑ From Outcome"));

    // @ts-expect-error
    expect(routeData.timingCalculations.Outcome).toBe("parentOnly");
  });

});
