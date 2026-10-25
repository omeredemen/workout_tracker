import { describe, expect, it } from "vitest";
import { fromDisplay, toDisplay } from "../units";

describe("unit conversion", () => {
  it("leaves kg alone", () => {
    expect(toDisplay(52.5, "kg")).toBe(52.5);
    expect(fromDisplay(52.5, "kg")).toBe(52.5);
  });

  it("converts to lb and back without drifting", () => {
    expect(toDisplay(100, "lb")).toBe(220.5);
    for (const lb of [45, 135, 22.5, 7.5, 315]) {
      expect(toDisplay(fromDisplay(lb, "lb"), "lb")).toBe(lb);
    }
  });
});
