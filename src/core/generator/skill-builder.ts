import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import type { SkillFrontmatter } from "../skill-parser.js";
import { parseSkillMd, serializeFrontmatter } from "../skill-parser.js";
import { parseNamespacedName, skillDirPath } from "../namespace.js";
import { registerSkill } from "../usage.js";

const SKM_BASE_DIR = path.join(os.homedir(), ".skm", "skills");

export interface ParsedSkillOutput {
  frontmatter: SkillFrontmatter;
  body: string;
}

export function parseLlmOutput(raw: string): ParsedSkillOutput {
  // Strip markdown code fences if present
  let content = raw.trim();
  if (content.startsWith("```")) {
    const firstNewline = content.indexOf("\n");
    const lastFence = content.lastIndexOf("```");
    if (firstNewline > 0 && lastFence > firstNewline) {
      content = content.slice(firstNewline + 1, lastFence).trim();
    }
  }

  const parsed = parseSkillMd(content, "<llm-output>");
  return {
    frontmatter: parsed.frontmatter,
    body: parsed.body,
  };
}

export function injectNamespace(name: string, namespace: string): string {
  if (name.includes(":")) {
    return name;
  }
  return `${namespace}:${name}`;
}

export async function saveGeneratedSkill(
  parsed: ParsedSkillOutput,
  namespace: string,
): Promise<string> {
  const fullSkillName = injectNamespace(parsed.frontmatter.name, namespace);
  const parsedName = parseNamespacedName(fullSkillName);
  const dirPath = skillDirPath(parsedName, SKM_BASE_DIR);

  fs.mkdirSync(dirPath, { recursive: true });

  const skillMdPath = path.join(dirPath, "SKILL.md");
  const content = `${serializeFrontmatter(parsed.frontmatter)}\n\n${parsed.body}\n`;
  fs.writeFileSync(skillMdPath, content, "utf-8");

  registerSkill(parsed.frontmatter.name, parsedName.namespace, "agent");

  return skillMdPath;
}
