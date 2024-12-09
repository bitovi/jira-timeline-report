import { expect, test, describe, it, vi } from "vitest";
import { AllTeamData, createEmptyConfiguration } from "./shared";
import { updateAllTeamData } from "./fetcher";
import { AppStorage } from "../../../../../../../jira/storage/common";

const getMockStorage = (): AppStorage => ({
  get: vi.fn(),
  update: vi.fn(),
  storageInitialized: vi.fn(),
});

describe("updateAllTeamData", () => {
  it("should remove null team config values", async () => {
    const input: AllTeamData = {
      __GLOBAL__: {
        defaults: { ...createEmptyConfiguration(), sprintLength: 1 },
        foobar: { ...createEmptyConfiguration(), sprintLength: 2 },
      },
      bazbat: {
        defaults: { ...createEmptyConfiguration(), sprintLength: 3 },
        booyah: { ...createEmptyConfiguration(), sprintLength: 4 },
        fizzbuzz: { ...createEmptyConfiguration() },
      },
      ohhyah: {
        defaults: { ...createEmptyConfiguration() },
        bruther: { ...createEmptyConfiguration() },
      },
    };
    const expected = [
      "all-team-data",
      {
        __GLOBAL__: {
          defaults: {
            sprintLength: 1,
          },
          foobar: {
            sprintLength: 2,
          },
        },
        bazbat: {
          defaults: {
            sprintLength: 3,
          },
          booyah: {
            sprintLength: 4,
          },
        },
      },
    ];

    const mockStorage = getMockStorage();
    await updateAllTeamData(mockStorage, input);

    expect(mockStorage.update).toBeCalledWith(...expected);
  });
});
