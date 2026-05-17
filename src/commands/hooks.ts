import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { cliInfo, cliSuccess } from "../cli/messages.js";

interface HooksOptions {
  install?: boolean;
  uninstall?: boolean;
}

const SETTINGS_PATH = path.join(os.homedir(), ".claude", "settings.json");

const TICK_HOOK = { type: "command" as const, command: "skm tick" };
const REVIEW_HOOK = { type: "command" as const, command: "skm review --auto-apply" };

interface HookEntry {
  type: string;
  command: string;
}

interface MatcherGroup {
  matcher: string;
  hooks: HookEntry[];
}

interface ClaudeSettings {
  hooks?: {
    PostToolUse?: MatcherGroup[];
    Stop?: MatcherGroup[];
  };
}

function loadSettings(): ClaudeSettings {
  if (!fs.existsSync(SETTINGS_PATH)) {
    return {};
  }
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, "utf-8");
    return JSON.parse(raw) as ClaudeSettings;
  } catch {
    return {};
  }
}

function saveSettings(settings: ClaudeSettings): void {
  const settingsDir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(settingsDir)) {
    fs.mkdirSync(settingsDir, { recursive: true });
  }
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
}

function isHookInstalled(groups: MatcherGroup[], targetCommand: string): boolean {
  return groups.some((g) => g.hooks.some((h) => h.command === targetCommand));
}

function installHooks(): void {
  const settings = loadSettings();

  if (!settings.hooks) {
    settings.hooks = {};
  }

  // Add tick hook to PostToolUse (match all tools)
  if (!settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = [];
  }
  if (!isHookInstalled(settings.hooks.PostToolUse, TICK_HOOK.command)) {
    settings.hooks.PostToolUse.push({
      matcher: "",
      hooks: [TICK_HOOK],
    });
  }

  // Add review hook to Stop
  if (!settings.hooks.Stop) {
    settings.hooks.Stop = [];
  }
  if (!isHookInstalled(settings.hooks.Stop, REVIEW_HOOK.command)) {
    settings.hooks.Stop.push({
      matcher: "",
      hooks: [REVIEW_HOOK],
    });
  }

  saveSettings(settings);
}

function uninstallHooks(): void {
  const settings = loadSettings();

  if (!settings.hooks) {
    return;
  }

  // Remove skm hooks
  if (settings.hooks.PostToolUse) {
    settings.hooks.PostToolUse = settings.hooks.PostToolUse.filter(
      (g) => !g.hooks.some((h) => h.command.startsWith("skm")),
    );
  }

  if (settings.hooks.Stop) {
    settings.hooks.Stop = settings.hooks.Stop.filter(
      (g) => !g.hooks.some((h) => h.command.startsWith("skm")),
    );
  }

  saveSettings(settings);
}

function getHookStatus(): { tick: boolean; review: boolean } {
  const settings = loadSettings();

  const tickInstalled = settings.hooks?.PostToolUse?.some(
    (g) => g.hooks.some((h) => h.command === TICK_HOOK.command),
  ) ?? false;

  const reviewInstalled = settings.hooks?.Stop?.some(
    (g) => g.hooks.some((h) => h.command === REVIEW_HOOK.command),
  ) ?? false;

  return { tick: tickInstalled, review: reviewInstalled };
}

export async function handleHooksAction(options: HooksOptions = {}): Promise<void> {
  if (options.install) {
    installHooks();
    cliSuccess("Hooks installed successfully.");
    cliInfo("- PostToolUse: skm tick");
    cliInfo("- Stop: skm review --auto-apply");
    return;
  }

  if (options.uninstall) {
    uninstallHooks();
    cliSuccess("Hooks uninstalled successfully.");
    return;
  }

  // Show current status
  const status = getHookStatus();

  cliInfo("Hook status:");
  cliInfo(`- tick (PostToolUse): ${status.tick ? "installed" : "not installed"}`);
  cliInfo(`- review (Stop): ${status.review ? "installed" : "not installed"}`);

  if (!status.tick && !status.review) {
    cliInfo("\nInstall hooks with: skm hooks --install");
  }
}
