import { describe, expect, it, vi } from "vitest";
import { unique } from "./unique";

describe("unique", () => {
  it("should scale linearly", () => {
    const list = [
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 1 },
      { id: 2 },
      { id: 3 },
      { id: 4 },
      { id: 5 },
      { id: 3 },
    ];
    const expected = [{ id: 1 }, { id: 2 }, { id: 3 }, { id: 4 }, { id: 5 }];
    const mockUniqueBy = vi.fn(({ id }) => id);

    const actual = unique(list, mockUniqueBy);

    expect(actual).toStrictEqual(expected);
    expect(mockUniqueBy).toBeCalledTimes(list.length);
  });
});
