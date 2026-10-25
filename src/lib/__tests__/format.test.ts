import { describe, expect, it } from "vitest";
import {
  formatShortDate,
  formatWeight,
  parseReps,
  parseWeight,
} from "../format";

describe("parseWeight", () => {
  it("accepts dots and commas, rounding to 2 decimals", () => {
    expect(parseWeight("52.5")).toBe(52.5);
    expect(parseWeight(" 52,5 ")).toBe(52.5);
    expect(parseWeight("10.333")).toBe(10.33);
  });
  it("returns null when empty and undefined when invalid", () => {
    expect(parseWeight("")).toBeNull();
    expect(parseWeight("abc")).toBeUndefined();
    expect(parseWeight("-5")).toBeUndefined();
    expect(parseWeight("5000")).toBeUndefined();
  });
});

describe("parseReps", () => {
  it("accepts whole numbers 0–200", () => {
    expect(parseReps("10")).toBe(10);
    expect(parseReps("0")).toBe(0);
    expect(parseReps("")).toBeNull();
    expect(parseReps("8.5")).toBeUndefined();
    expect(parseReps("201")).toBeUndefined();
  });
});

describe("formatting", () => {
  it("formats dates and weights", () => {
    expect(formatShortDate("2026-10-19")).toBe("Mon 19 Oct");
    expect(formatWeight(52.5)).toBe("52.5 kg");
    expect(formatWeight(null)).toBe("BW");
  });
});
