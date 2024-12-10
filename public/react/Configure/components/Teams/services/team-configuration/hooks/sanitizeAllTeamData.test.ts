import { expect, describe, it } from "vitest";
import { AllTeamData, Configuration, createEmptyConfiguration } from "../team-configuration/shared";
import { sanitizeAllTeamData } from "./sanitizeAllTeamData";

describe("updateAllTeamData", () => {
  it("should remove null team config values", () => {
    const allTeamData: AllTeamData = {
      __GLOBAL__: {
        defaults: { ...createEmptyConfiguration(), sprintLength: 1 },
        ["0"]: { ...createEmptyConfiguration(), sprintLength: 2 },
      },
      bazbat: {
        defaults: { ...createEmptyConfiguration(), sprintLength: 3 },
        ["0"]: { ...createEmptyConfiguration(), sprintLength: 4 },
        ["1"]: { ...createEmptyConfiguration() },
      },
      ohhyah: {
        defaults: { ...createEmptyConfiguration() },
        ["0"]: { ...createEmptyConfiguration() },
      },
    };
    const expected = {
      __GLOBAL__: {
        defaults: {
          sprintLength: 1,
          velocityPerSprint: 2,
        },
        ["0"]: {
          sprintLength: 2,
        },
      },
      bazbat: {
        defaults: {
          sprintLength: 3,
        },
        ["0"]: {
          sprintLength: 4,
          velocityPerSprint: 2,
        },
      },
    };

    const allTeamData2 = sanitizeAllTeamData(allTeamData, "__GLOBAL__", "defaults", {
      sprintLength: 1,
      velocityPerSprint: 2,
    } as Configuration);
    const actual = sanitizeAllTeamData(allTeamData2, "bazbat", "0", {
      sprintLength: 4,
      velocityPerSprint: 2,
    } as Configuration);

    expect(actual).toStrictEqual(expected);
  });
});
