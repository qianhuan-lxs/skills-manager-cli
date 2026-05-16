import { describe, it, expect, beforeAll, beforeEach, afterAll } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKM_DIR = path.join(os.homedir(), ".skm");
const USAGE_PATH = path.join(SKM_DIR, "usage.json");
const BACKUP_PATH = USAGE_PATH + ".test-backup";

describe("usage module", () => {
  beforeAll(() => {
    if (!fs.existsSync(SKM_DIR)) {
      fs.mkdirSync(SKM_DIR, { recursive: true });
    }
    if (fs.existsSync(USAGE_PATH)) {
      fs.copyFileSync(USAGE_PATH, BACKUP_PATH);
    }
  });

  beforeEach(() => {
    // Write empty array before each test for clean slate
    fs.writeFileSync(USAGE_PATH, "[]", "utf-8");
  });

  afterAll(() => {
    if (fs.existsSync(USAGE_PATH)) {
      fs.rmSync(USAGE_PATH);
    }
    if (fs.existsSync(BACKUP_PATH)) {
      fs.copyFileSync(BACKUP_PATH, USAGE_PATH);
      fs.rmSync(BACKUP_PATH);
    }
  });

  it("loadUsage returns [] when no file exists", async () => {
    // Delete the file to test the no-file case
    fs.rmSync(USAGE_PATH);
    const { loadUsage } = await import("./usage.js");
    const entries = loadUsage();
    expect(entries).toEqual([]);
  });

  it("loadUsage returns [] for empty file", async () => {
    const { loadUsage } = await import("./usage.js");
    const entries = loadUsage();
    expect(entries).toEqual([]);
  });

  it("registerSkill then loadUsage contains the entry", async () => {
    const { loadUsage, registerSkill } = await import("./usage.js");
    registerSkill("my-skill", null, "user");
    const entries = loadUsage();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("my-skill");
    expect(entries[0]!.namespace).toBeNull();
    expect(entries[0]!.useCount).toBe(1);
    expect(entries[0]!.state).toBe("active");
    expect(entries[0]!.createdBy).toBe("user");
  });

  it("registerSkill same skill twice increments useCount", async () => {
    const { loadUsage, registerSkill } = await import("./usage.js");
    registerSkill("dup-skill", null, "user");
    registerSkill("dup-skill", null, "user");
    const entries = loadUsage();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.useCount).toBe(2);
  });

  it("registerSkill with namespace stores namespace", async () => {
    const { loadUsage, registerSkill } = await import("./usage.js");
    registerSkill("ns-skill", "myns", "agent");
    const entries = loadUsage();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.namespace).toBe("myns");
    expect(entries[0]!.createdBy).toBe("agent");
  });

  it("removeSkill removes the entry by full name", async () => {
    const { loadUsage, registerSkill, removeSkill } = await import("./usage.js");
    registerSkill("rm-skill-a", null, "user");
    registerSkill("rm-skill-b", null, "user");
    expect(loadUsage()).toHaveLength(2);

    removeSkill("rm-skill-a");
    const entries = loadUsage();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.name).toBe("rm-skill-b");
  });

  it("removeSkill works with namespaced full name", async () => {
    const { loadUsage, registerSkill, removeSkill } = await import("./usage.js");
    registerSkill("nsrm-skill", "ns", "user");
    removeSkill("ns:nsrm-skill");
    expect(loadUsage()).toHaveLength(0);
  });

  it("incrementPatchCount increments patchCount", async () => {
    const { loadUsage, registerSkill, incrementPatchCount } = await import("./usage.js");
    registerSkill("patch-skill", null, "user");
    incrementPatchCount("patch-skill");
    const entries = loadUsage();
    expect(entries[0]!.patchCount).toBe(1);

    incrementPatchCount("patch-skill");
    const updated = loadUsage();
    expect(updated[0]!.patchCount).toBe(2);
  });

  it("incrementPatchCount on non-existent skill does nothing", async () => {
    const { loadUsage, registerSkill, incrementPatchCount } = await import("./usage.js");
    registerSkill("exists-skill", null, "user");
    incrementPatchCount("nonexistent-skill");
    const entries = loadUsage();
    expect(entries).toHaveLength(1);
    expect(entries[0]!.patchCount).toBe(0);
  });

  it("saveUsage and loadUsage round-trips data", async () => {
    const { loadUsage, saveUsage } = await import("./usage.js");
    const entries = [
      {
        name: "roundtrip-skill",
        namespace: null,
        state: "active" as const,
        useCount: 5,
        createdBy: "user" as const,
        createdAt: "2025-01-01T00:00:00.000Z",
        lastUsedAt: "2025-01-02T00:00:00.000Z",
        patchCount: 2,
      },
    ];
    saveUsage(entries);
    const loaded = loadUsage();
    expect(loaded).toEqual(entries);
  });
});
