export interface SkillFrontmatter {
  name: string;
  description: string;
  version?: string;
  metadata?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface ParsedSkill {
  frontmatter: SkillFrontmatter;
  body: string;
  raw: string;
  filePath: string;
}

export const FRONTMATTER_REGEX = /^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/;

export function parseSkillMd(content: string, filePath: string): ParsedSkill {
  const match = content.match(FRONTMATTER_REGEX);
  if (!match) {
    throw new Error(`Invalid SKILL.md: missing YAML frontmatter in ${filePath}`);
  }
  const [, rawFrontmatter, body] = match;
  const frontmatter = parseYamlFrontmatter(rawFrontmatter!, filePath);
  if (!frontmatter.name || typeof frontmatter.name !== "string") {
    throw new Error(`Invalid SKILL.md: "name" field is required in ${filePath}`);
  }
  if (!frontmatter.description || typeof frontmatter.description !== "string") {
    throw new Error(`Invalid SKILL.md: "description" field is required in ${filePath}`);
  }
  return {
    frontmatter: frontmatter as SkillFrontmatter,
    body: body!.trim(),
    raw: content,
    filePath,
  };
}

function parseYamlFrontmatter(raw: string, _filePath: string): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  const lines = raw.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const colonIdx = trimmed.indexOf(":");
    if (colonIdx === -1) continue;
    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();
    if ((value as string).startsWith('"') && (value as string).endsWith('"')) {
      value = (value as string).slice(1, -1);
    } else if (value === "true") {
      value = true;
    } else if (value === "false") {
      value = false;
    } else if (/^\d+$/.test(value as string)) {
      value = parseInt(value as string, 10);
    } else if ((value as string).startsWith("[") && (value as string).endsWith("]")) {
      value = (value as string)
        .slice(1, -1)
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""));
    }
    if (key.includes(".")) {
      setNestedValue(result, key, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

function setNestedValue(obj: Record<string, unknown>, keyPath: string, value: unknown): void {
  const keys = keyPath.split(".");
  let current: Record<string, unknown> = obj;
  for (let i = 0; i < keys.length - 1; i++) {
    if (current[keys[i]!] === undefined || typeof current[keys[i]!] !== "object") {
      current[keys[i]!] = {};
    }
    current = current[keys[i]!] as Record<string, unknown>;
  }
  current[keys[keys.length - 1]!] = value;
}

export function serializeFrontmatter(fm: SkillFrontmatter): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(fm)) {
    if (value === undefined) continue;
    if (typeof value === "string") {
      lines.push(`${key}: "${value.includes('"') ? value.replace(/"/g, '\\"') : value}"`);
    } else if (typeof value === "number" || typeof value === "boolean") {
      lines.push(`${key}: ${value}`);
    } else if (Array.isArray(value)) {
      lines.push(`${key}: [${value.map((v) => `"${v}"`).join(", ")}]`);
    }
  }
  lines.push("---");
  return lines.join("\n");
}
