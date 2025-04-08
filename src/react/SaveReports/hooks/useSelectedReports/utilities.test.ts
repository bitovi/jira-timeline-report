import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { paramsEqual, getReportFromParams, paramsMatchReport } from "./utilities";

const mockReports = {
  "1": { id: "1", name: "Report 1", queryParams: "param1=value1&param2=value2" },
  "2": { id: "2", name: "Report 2", queryParams: "param1=value1" },
};

describe("useSelectedReports > utilities", () => {
  let originalLocation: Location;

  beforeEach(() => {
    vi.resetAllMocks();

    originalLocation = window.location;

    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        search: "",
        assign: vi.fn(),
      },
    });
  });

  afterEach(() => {
    Object.defineProperty(window, "location", {
      configurable: true,
      value: originalLocation,
    });
  });

  describe("paramsEqual", () => {
    it("returns true for equal URLSearchParams", () => {
      const params1 = new URLSearchParams("param1=value1&param2=value2");
      const params2 = new URLSearchParams("param2=value2&param1=value1");

      expect(paramsEqual(params1, params2)).toBe(true);
    });

    it("returns false for URLSearchParams with different lengths", () => {
      const params1 = new URLSearchParams("param1=value1&param2=value2");
      const params2 = new URLSearchParams("param1=value1");

      expect(paramsEqual(params1, params2)).toBe(false);
    });

    it("returns false for URLSearchParams with different values", () => {
      const params1 = new URLSearchParams("param1=value1&param2=value2");
      const params2 = new URLSearchParams("param1=value1&param2=differentValue");

      expect(paramsEqual(params1, params2)).toBe(false);
    });
  });

  describe("getReportFromParams", () => {
    it("returns the correct report based on URLSearchParams", () => {
      window.location.search = "?report=1";

      const report = getReportFromParams(mockReports);
      expect(report).toEqual(mockReports["1"]);
    });

    it("returns undefined if the 'report' param is missing", () => {
      window.location.search = "?otherParam=1";

      const report = getReportFromParams(mockReports);
      expect(report).toBeUndefined();
    });

    it("returns undefined if no matching report is found", () => {
      window.location.search = "?report=nonexistent";

      const report = getReportFromParams(mockReports);
      expect(report).toBeUndefined();
    });
  });

  describe("paramsMatchReport", () => {
    it("returns true when params match the report's queryParams", () => {
      window.location.search = "?report=1";
      const params = new URLSearchParams("?report=1&settings=1");

      expect(paramsMatchReport(params, mockReports)).toBe(true);
    });

    it("returns false when params do not match the report's queryParams", () => {
      window.location.search = "?report=1";
      const params = new URLSearchParams("param1=value1&param2=differentValue");

      expect(paramsMatchReport(params, mockReports)).toBe(false);
    });

    it("ignores params specified in paramsToOmit", () => {
      window.location.search = "?report=1";
      const params = new URLSearchParams("?report=1&settings=1");

      expect(paramsMatchReport(params, mockReports, ["settings", "report"])).toBe(true);
    });

    it("returns false if no matching report is found", () => {
      window.location.search = "?report=nonexistent";
      const params = new URLSearchParams("param1=value1&param2=value2");

      expect(paramsMatchReport(params, mockReports)).toBe(false);
    });
  });
});
