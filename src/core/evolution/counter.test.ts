import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKM_DIR = path.join(os.homedir(), ".skm");
const COUNTER_PATH = path.join(SKM_DIR, "iteration.json");
const BACKUP_PATH = COUNTER_PATH + ".test-backup";

describe("evolution counter", () => {
  beforeAll(() => {
    // Ensure .skm dir exists and back up existing counter file
    if (!fs.existsSync(SKM_DIR)) {
      fs.mkdirSync(SKM_DIR, { recursive: true });
    }
    if (fs.existsSync(COUNTER_PATH)) {
      fs.copyFileSync(COUNTER_PATH, BACKUP_PATH);
    }
  });

  beforeEach(() => {
    // Write a fresh zeroed counter before each test
    fs.writeFileSync(
      COUNTER_PATH,
      JSON.stringify({ count: 0, lastResetAt: new Date().toISOString(), projectName: "default" }, null, 2),
      "utf-8",
    );
  });

  afterAll(() => {
    // Restore original counter file
    if (fs.existsSync(COUNTER_PATH)) {
      fs.rmSync(COUNTER_PATH);
    }
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, COUNTER_PATH);
      fs.rmSync(BACKUP_PATH);
    }
  });

  it("getCounter returns current state", async () => {
    const { getCounter } = await import("./counter.js");
    const counter = getCounter();
    expect(counter.count).toBe(0);
    expect(counter.projectName).toBe("default");
  });

  it("incrementCounter increases the count", async () => {
    const { incrementCounter, getCounter } = await import("./counter.js");
    const result = incrementCounter();
    expect(result).toBe(1);

    const result2 = incrementCounter();
    expect(result2).toBe(2);

    const state = getCounter();
    expect(state.count).toBe(2);
  });

  it("resetCounter sets count to 0", async () => {
    const { incrementCounter, getCounter, resetCounter } = await import("./counter.js");
    incrementCounter();
    incrementCounter();
    expect(getCounter().count).toBe(2);

    resetCounter();
    const state = getCounter();
    expect(state.count).toBe(0);
  });

  it("resetCounter updates lastResetAt timestamp", async () => {
    const { incrementCounter, resetCounter, getCounter } = await import("./counter.js");
    incrementCounter();

    resetCounter();
    const state = getCounter();

    expect(typeof state.lastResetAt).toBe("string");
    expect(state.lastResetAt.length).toBeGreaterThan(0);
    expect(new Date(state.lastResetAt).getTime()).not.toBeNaN();
  });

  it("counter persists across calls", async () => {
    const { incrementCounter, getCounter } = await import("./counter.js");
    incrementCounter();
    incrementCounter();
    incrementCounter();

    const state = getCounter();
    expect(state.count).toBe(3);
  });
});
