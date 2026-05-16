import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { glob } from "glob";
import { generateWithLlm } from "../generator/llm-client.js";

export interface SkillSuggestion {
  name: string;
  description: string;
  reason: string;
  priority: "high" | "medium" | "low";
}

export const SKILL_REVIEW_PROMPT = `You are a skill reviewer for Claude Code. Your task is to analyze conversation transcripts and identify patterns that would be valuable to capture as reusable skills.

A good skill candidate should:
1. Represent a repeatable pattern or workflow
2. Be applicable across multiple contexts or projects
3. Encapsulate specific domain knowledge or best practices
4. Save time when invoked in future sessions

Analyze the conversation and identify skill-worthy patterns. For each pattern, provide:
- name: A concise, lowercase, hyphenated name for the skill
- description: A clear one-sentence description of what the skill does
- reason: Why this pattern is worth capturing as a skill
- priority: "high" (frequent, high-impact patterns), "medium" (useful but context-specific), or "low" (nice-to-have but niche)

Return your response as a JSON array of objects. Do not include any text outside the JSON array.

Example output format:
[
  {
    "name": "git-commit-conventional",
    "description": "Creates commits following conventional commit format with proper attribution",
    "reason": "This pattern appears frequently across sessions and ensures consistent git history",
    "priority": "high"
  }
]`;

const SESSIONS_DIR = path.join(os.homedir(), ".claude", "projects");
const MAX_SESSION_LINES = 100;

interface SessionMessage {
  role: "user" | "assistant";
  content: string;
}

async function findLatestSession(): Promise<string | null> {
  const sessionFiles = await glob("**/*.jsonl", {
    cwd: SESSIONS_DIR,
    absolute: true,
    ignore: ["**/node_modules/**"],
  });

  if (sessionFiles.length === 0) {
    return null;
  }

  // Sort by modification time, most recent first
  sessionFiles.sort((a, b) => {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statB.mtimeMs - statA.mtimeMs;
  });

  return sessionFiles[0]!;
}

async function readSessionMessages(sessionPath: string, limit: number = MAX_SESSION_LINES): Promise<SessionMessage[]> {
  const content = fs.readFileSync(sessionPath, "utf-8");
  const lines = content.split("\n").filter(Boolean);

  // Get the last N lines
  const recentLines = lines.slice(-limit);

  const messages: SessionMessage[] = [];
  for (const line of recentLines) {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const role = parsed.role as string;
      if (role === "user" || role === "assistant") {
        const content = parsed.content as string;
        if (typeof content === "string") {
          messages.push({ role, content });
        }
      }
    } catch {
      // Skip invalid JSON lines
    }
  }

  return messages;
}

function buildReviewContext(messages: SessionMessage[]): string {
  return messages
    .map((m) => `## ${m.role.toUpperCase()}\n${m.content}`)
    .join("\n\n");
}

export async function reviewSession(sessionFile?: string): Promise<SkillSuggestion[]> {
  let sessionPath = sessionFile;

  if (!sessionPath) {
    const foundPath = await findLatestSession();
    if (!foundPath) {
      throw new Error("No Claude Code session files found");
    }
    sessionPath = foundPath;
  } else if (!fs.existsSync(sessionPath)) {
    throw new Error(`Session file not found: ${sessionPath}`);
  }

  const messages = await readSessionMessages(sessionPath);

  if (messages.length === 0) {
    return [];
  }

  const context = buildReviewContext(messages);

  const response = await generateWithLlm(SKILL_REVIEW_PROMPT, context);

  // Parse JSON response
  let cleaned = response.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.slice(7);
  }
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith("```")) {
    cleaned = cleaned.slice(0, -3);
  }
  cleaned = cleaned.trim();

  try {
    const parsed = JSON.parse(cleaned) as unknown[];
    if (!Array.isArray(parsed)) {
      throw new Error("Response is not an array");
    }
    return parsed as SkillSuggestion[];
  } catch {
    throw new Error("Failed to parse LLM response as JSON array");
  }
}
