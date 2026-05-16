import fs from "node:fs";
import path from "node:path";
import type { SkillFrontmatter } from "../core/skill-parser.js";
import { serializeFrontmatter } from "../core/skill-parser.js";
import { parseNamespacedName, skillDirPath } from "../core/namespace.js";
import { registerSkill } from "../core/usage.js";
import { cliSuccess, cliError } from "../cli/messages.js";

interface CreateOptions {
  description?: string;
  namespace?: string;
  content?: string;
}

export async function handleCreateAction(name: string, options: CreateOptions): Promise<void> {
  try {
    // Parse and validate name
    const parsed = parseNamespacedName(name);

    // Override namespace if provided via option
    const ns = options.namespace ?? parsed.namespace;
    const finalName = ns ? `${ns}:${parsed.name}` : parsed.name;

    // Check if skill already exists
    const projectSkillsDir = ".claude/skills";
    const skillDir = skillDirPath({ namespace: ns, name: parsed.name, fullName: finalName }, projectSkillsDir);
    const skillPath = path.join(skillDir, "SKILL.md");

    if (fs.existsSync(skillPath)) {
      cliError(`Skill "${finalName}" already exists at ${skillPath}`);
      process.exit(1);
    }

    // Build frontmatter
    const frontmatter: SkillFrontmatter = {
      name: parsed.name,
      description: options.description ?? "",
      version: "1.0.0",
    };

    // Build content
    const frontmatterStr = serializeFrontmatter(frontmatter);
    const body = options.content ?? "";
    const fullContent = body ? `${frontmatterStr}\n\n${body}` : `${frontmatterStr}\n`;

    // Create directory and write file
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillPath, fullContent, "utf-8");

    // Register in usage
    registerSkill(parsed.name, ns ?? null, "user");

    cliSuccess(`Skill "${finalName}" created at ${skillPath}`);
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to create skill");
    }
    process.exit(1);
  }
}
