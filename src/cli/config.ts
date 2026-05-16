import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { z } from "zod/v4";

const SKM_DIR = path.join(os.homedir(), ".skm");
const CONFIG_PATH = path.join(SKM_DIR, "config.json");

const configSchema = z.object({
  llm: z.object({
    baseUrl: z.string().optional(),
    apiKey: z.string().optional(),
    model: z.string().optional(),
  }).optional(),
  evolution: z.object({
    staleAfterDays: z.number().default(30),
    archiveAfterDays: z.number().default(90),
    namespaces: z.string().default("skm"),
    nudgeInterval: z.number().default(10),
  }).optional(),
  output: z.object({
    format: z.enum(["terminal", "json", "markdown"]).default("terminal"),
  }).optional(),
});

export type SkmConfig = z.infer<typeof configSchema>;

function ensureSkmDir(): void {
  if (!fs.existsSync(SKM_DIR)) {
    fs.mkdirSync(SKM_DIR, { recursive: true });
  }
}

export function loadConfig(): SkmConfig {
  if (!fs.existsSync(CONFIG_PATH)) {
    return {};
  }
  const raw = fs.readFileSync(CONFIG_PATH, "utf-8");
  const parsed = JSON.parse(raw);
  return configSchema.parse(parsed);
}

export function saveConfig(config: SkmConfig): void {
  ensureSkmDir();
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), "utf-8");
}

export function getConfigValue(keyPath: string): unknown {
  const config = loadConfig();
  const keys = keyPath.split(".");
  let current: unknown = config;
  for (const key of keys) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

export function setConfigValue(keyPath: string, value: string): void {
  const config = loadConfig();
  const keys = keyPath.split(".");
  let current: Record<string, unknown> = config as Record<string, unknown>;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]] === undefined || typeof current[keys[i]] !== "object") {
      current[keys[i]] = {};
    }
    current = current[keys[i]] as Record<string, unknown>;
  }
  const lastKey = keys[keys.length - 1]!;
  // Try to parse as number or boolean, otherwise keep as string
  if (/^\d+$/.test(value)) {
    current[lastKey] = parseInt(value, 10);
  } else if (value === "true") {
    current[lastKey] = true;
  } else if (value === "false") {
    current[lastKey] = false;
  } else {
    current[lastKey] = value;
  }
  saveConfig(configSchema.parse(config));
}

export function resolveLlmConfig(cliOverrides?: { baseUrl?: string; apiKey?: string; model?: string }): {
  baseUrl: string;
  apiKey: string;
  model?: string;
} | null {
  const config = loadConfig();
  const baseUrl = cliOverrides?.baseUrl ?? process.env.SKM_BASE_URL ?? config.llm?.baseUrl;
  const apiKey = cliOverrides?.apiKey ?? process.env.SKM_API_KEY ?? config.llm?.apiKey;
  const model = cliOverrides?.model ?? process.env.SKM_MODEL ?? config.llm?.model;
  if (!baseUrl || !apiKey) return null;
  return { baseUrl, apiKey, model };
}
