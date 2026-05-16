import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  truncateOutput,
  formatRiskScore,
  paginate,
  formatTable,
} from "./output.js";
import { setOutputFormat } from "./messages.js";

describe("truncateOutput", () => {
  it("returns short string unchanged", () => {
    const short = "Hello world";
    expect(truncateOutput(short)).toBe(short);
  });

  it("truncates long string with default limit", () => {
    const long = "a".repeat(30_000);
    const result = truncateOutput(long);
    expect(result.length).toBeLessThan(long.length);
    expect(result).toContain("truncated at 25000 chars");
    expect(result.startsWith("a".repeat(25_000))).toBe(true);
  });

  it("truncates with custom limit", () => {
    const text = "abcdefghij";
    const result = truncateOutput(text, 5);
    expect(result).toBe("abcde\n... (truncated at 5 chars)");
  });

  it("does not truncate when exactly at limit", () => {
    const text = "a".repeat(100);
    expect(truncateOutput(text, 100)).toBe(text);
  });
});

describe("formatRiskScore", () => {
  beforeEach(() => {
    setOutputFormat("terminal");
  });

  it("formats safe score (>= 80) in green", () => {
    const result = formatRiskScore(100);
    expect(result).toContain("100");
    expect(result).toContain("safe");
  });

  it("formats warning score (50-79) in yellow", () => {
    const result = formatRiskScore(65);
    expect(result).toContain("65");
    expect(result).toContain("warning");
  });

  it("formats danger score (< 50) in red", () => {
    const result = formatRiskScore(30);
    expect(result).toContain("30");
    expect(result).toContain("danger");
  });

  it("formats score at exact boundary 80 as safe", () => {
    const result = formatRiskScore(80);
    expect(result).toContain("safe");
  });

  it("formats score at exact boundary 50 as warning", () => {
    const result = formatRiskScore(50);
    expect(result).toContain("warning");
  });

  it("formats score at 49 as danger", () => {
    const result = formatRiskScore(49);
    expect(result).toContain("danger");
  });

  it("returns plain number in json mode", () => {
    setOutputFormat("json");
    const result = formatRiskScore(75);
    expect(result).toBe("75");
    setOutputFormat("terminal");
  });
});

describe("paginate", () => {
  it("returns all items when within limit", () => {
    const items = [1, 2, 3, 4, 5];
    const result = paginate(items, 0, 10);
    expect(result.data).toEqual([1, 2, 3, 4, 5]);
    expect(result.total).toBe(5);
    expect(result.has_more).toBe(false);
    expect(result.next_offset).toBeNull();
  });

  it("returns sliced items with offset and limit", () => {
    const items = [1, 2, 3, 4, 5];
    const result = paginate(items, 2, 2);
    expect(result.data).toEqual([3, 4]);
    expect(result.total).toBe(5);
    expect(result.has_more).toBe(true);
    expect(result.next_offset).toBe(4);
  });

  it("returns has_more=false when at the end", () => {
    const items = [1, 2, 3];
    const result = paginate(items, 1, 5);
    expect(result.data).toEqual([2, 3]);
    expect(result.has_more).toBe(false);
    expect(result.next_offset).toBeNull();
  });

  it("uses default offset=0 and limit=50", () => {
    const items = Array.from({ length: 60 }, (_, i) => i);
    const result = paginate(items);
    expect(result.data).toHaveLength(50);
    expect(result.total).toBe(60);
    expect(result.has_more).toBe(true);
    expect(result.next_offset).toBe(50);
  });

  it("handles empty array", () => {
    const result = paginate([], 0, 10);
    expect(result.data).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.has_more).toBe(false);
    expect(result.next_offset).toBeNull();
  });
});

describe("formatTable", () => {
  beforeEach(() => {
    setOutputFormat("terminal");
  });

  it("formats headers and rows as a table", () => {
    const headers = ["Name", "Score"];
    const rows = [["skill-a", "90"], ["skill-b", "75"]];
    const result = formatTable(headers, rows);

    expect(result).toContain("Name");
    expect(result).toContain("Score");
    expect(result).toContain("skill-a");
    expect(result).toContain("skill-b");
    expect(result).toContain("90");
    expect(result).toContain("75");
  });

  it("includes a separator line", () => {
    const headers = ["Col"];
    const rows = [["val"]];
    const result = formatTable(headers, rows);
    // Separator is made of ─ characters
    expect(result).toContain("─");
  });

  it("returns JSON in json mode", () => {
    setOutputFormat("json");
    const headers = ["Name", "Value"];
    const rows = [["test", "42"]];
    const result = formatTable(headers, rows);
    const parsed = JSON.parse(result);
    expect(parsed).toEqual([{ Name: "test", Value: "42" }]);
    setOutputFormat("terminal");
  });
});
