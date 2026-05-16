import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const COUNTER_DIR = path.join(os.homedir(), ".skm");
const COUNTER_PATH = path.join(COUNTER_DIR, "iteration.json");

export interface CounterData {
  count: number;
  lastResetAt: string;
  projectName: string;
}

const DEFAULT_DATA: CounterData = {
  count: 0,
  lastResetAt: new Date().toISOString(),
  projectName: "default",
};

function ensureDir(): void {
  if (!fs.existsSync(COUNTER_DIR)) {
    fs.mkdirSync(COUNTER_DIR, { recursive: true });
  }
}

function loadData(): CounterData {
  if (!fs.existsSync(COUNTER_PATH)) {
    return DEFAULT_DATA;
  }
  const raw = fs.readFileSync(COUNTER_PATH, "utf-8");
  try {
    return JSON.parse(raw) as CounterData;
  } catch {
    return DEFAULT_DATA;
  }
}

function saveData(data: CounterData): void {
  ensureDir();
  fs.writeFileSync(COUNTER_PATH, JSON.stringify(data, null, 2), "utf-8");
}

export function getCounter(): CounterData {
  return loadData();
}

export function incrementCounter(): number {
  const data = loadData();
  data.count += 1;
  saveData(data);
  return data.count;
}

export function resetCounter(): void {
  const data = loadData();
  data.count = 0;
  data.lastResetAt = new Date().toISOString();
  saveData(data);
}
