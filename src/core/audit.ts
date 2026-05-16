import fs from "node:fs";
import path from "node:path";
import os from "node:os";

const SKM_DIR = path.join(os.homedir(), ".skm");
const AUDIT_LOG = path.join(SKM_DIR, "mcp-audit.log");

export function validatePathSafety(inputPath: string): void {
  const resolved = path.resolve(inputPath);
  // Block path traversal
  if (inputPath.includes("..")) {
    throw new Error("Path traversal detected: '..' not allowed");
  }
  // Block absolute paths outside allowed directories
  const cwd = process.cwd();
  const home = os.homedir();
  const allowedPrefixes = [
    path.join(cwd, ".claude", "skills"),
    path.join(home, ".claude", "skills"),
    path.join(home, ".skm"),
  ];
  const isAllowed = allowedPrefixes.some((p) => resolved.startsWith(p)) || resolved.startsWith(cwd);
  if (!isAllowed) {
    throw new Error(`Path outside allowed directories: ${inputPath}`);
  }
}

export function logAudit(toolName: string, args: Record<string, unknown>): void {
  if (!fs.existsSync(SKM_DIR)) {
    fs.mkdirSync(SKM_DIR, { recursive: true });
  }
  const entry = {
    timestamp: new Date().toISOString(),
    tool: toolName,
    args,
  };
  fs.appendFileSync(AUDIT_LOG, JSON.stringify(entry) + "\n", "utf-8");
}
