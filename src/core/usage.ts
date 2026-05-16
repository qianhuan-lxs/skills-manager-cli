import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKM_DIR = path.join(os.homedir(), ".skm");
const USAGE_PATH = path.join(SKM_DIR, "usage.json");

export interface SkillUsageEntry {
  name: string;
  namespace: string | null;
  state: "active" | "stale" | "archived";
  useCount: number;
  createdBy: "agent" | "user";
  createdAt: string; // ISO date
  lastUsedAt: string;
  patchCount?: number;
  absorbedInto?: string;
}

function ensureSkmDir(): void {
  if (!fs.existsSync(SKM_DIR)) {
    fs.mkdirSync(SKM_DIR, { recursive: true });
  }
}

export function loadUsage(): SkillUsageEntry[] {
  if (!fs.existsSync(USAGE_PATH)) {
    return [];
  }
  const raw = fs.readFileSync(USAGE_PATH, "utf-8");
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveUsage(entries: SkillUsageEntry[]): void {
  ensureSkmDir();
  fs.writeFileSync(USAGE_PATH, JSON.stringify(entries, null, 2), "utf-8");
}

export function registerSkill(
  name: string,
  namespace: string | null,
  createdBy: "agent" | "user",
): void {
  const entries = loadUsage();
  const now = new Date().toISOString();

  // Check if already exists
  const existingIndex = entries.findIndex((e) => e.name === name && e.namespace === namespace);
  if (existingIndex !== -1) {
    // Update existing
    entries[existingIndex]!.lastUsedAt = now;
    entries[existingIndex]!.useCount++;
    saveUsage(entries);
    return;
  }

  // Create new entry
  const newEntry: SkillUsageEntry = {
    name,
    namespace,
    state: "active",
    useCount: 1,
    createdBy,
    createdAt: now,
    lastUsedAt: now,
    patchCount: 0,
  };

  entries.push(newEntry);
  saveUsage(entries);
}

export function removeSkill(fullName: string): void {
  const entries = loadUsage();
  const filtered = entries.filter((e) => {
    const entryFullName = e.namespace ? `${e.namespace}:${e.name}` : e.name;
    return entryFullName !== fullName;
  });
  saveUsage(filtered);
}

export function incrementPatchCount(fullName: string): void {
  const entries = loadUsage();
  const entry = entries.find((e) => {
    const entryFullName = e.namespace ? `${e.namespace}:${e.name}` : e.name;
    return entryFullName === fullName;
  });

  if (entry) {
    entry.patchCount = (entry.patchCount ?? 0) + 1;
    entry.lastUsedAt = new Date().toISOString();
    saveUsage(entries);
  }
}

export function getSkillUsage(fullName: string): SkillUsageEntry | null {
  const entries = loadUsage();
  return entries.find((e) => {
    const entryFullName = e.namespace ? `${e.namespace}:${e.name}` : e.name;
    return entryFullName === fullName;
  }) ?? null;
}
