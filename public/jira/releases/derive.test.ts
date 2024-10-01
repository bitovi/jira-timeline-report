import { expect, test } from "vitest";
import { deriveReleases } from "./derive";
import { NormalizedRelease } from "../shared/types";

test("deriveReleases with mixed release names", () => {
  const input = [
    { id: "a", name: "first" },
    { id: "b", name: "second" },
    { id: "c", name: "RELEASE-1.2.3" },
    { id: "d", name: "RELEASE-2" },
  ] as NormalizedRelease[];

  const output = deriveReleases(input);

  const derived = output.map((release) => release.names);

  expect(derived).toStrictEqual([
    { shortName: "first", shortVersion: null, version: null, semver: false },
    { shortName: "second", shortVersion: null, version: null, semver: false },
    {
      shortName: "1.2.3",
      shortVersion: "1.2.3",
      version: "1.2.3",
      semver: true,
    },
    { shortName: "2", shortVersion: "2", version: "2.0.0", semver: true },
  ]);
});

test("deriveReleases with Bitovi naming convention", () => {
  const input = [
    { id: "a", name: "Bitovi-One" },
    { id: "b", name: "Bitovi-Two" },
  ] as NormalizedRelease[];

  const output = deriveReleases(input).map((release) => release.names);

  expect(output).toStrictEqual([
    { shortName: "One", shortVersion: null, version: null, semver: false },
    { shortName: "Two", shortVersion: null, version: null, semver: false },
  ]);
});

// Additional test cases can be added here to cover more scenarios
