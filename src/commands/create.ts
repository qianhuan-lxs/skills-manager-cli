import fs from "node:fs";
import path from "node:path";
import type { SkillFrontmatter } from "../core/skill-parser.js";
import { serializeFrontmatter } from "../core/skill-parser.js";
import { parseNamespacedName, validateName } from "../core/namespace.js";
import { registerSkill } from "../core/usage.js";
import { cliSuccess, cliError } from "../cli/messages.js";

interface CreateOptions {
  description?: string;
  namespace?: string;
  content?: string;
}

export async function handleCreateAction(name: string, options: CreateOptions): Promise<void> {
  try {
    // Parse name (may contain namespace: prefix)
    const parsed = parseNamespacedName(name);
    const ns = options.namespace ?? parsed.namespace;
    const skillName = parsed.name;

    // Validate skill name
    validateName(skillName);

    // Full name includes namespace prefix in frontmatter
    const fullName = ns ? `${ns}:${skillName}` : skillName;

    // Directory is always .claude/skills/<skill-name>/SKILL.md (no namespace subdirectory)
    const skillsDir = ".claude/skills";
    const skillDir = path.join(skillsDir, skillName);
    const skillPath = path.join(skillDir, "SKILL.md");

    // Check if skill already exists
    if (fs.existsSync(skillPath)) {
      cliError(`Skill "${skillName}" already exists at ${skillPath}`);
      process.exit(1);
    }

    // Build frontmatter — name field includes namespace prefix
    const frontmatter: SkillFrontmatter = {
      name: fullName,
      description: options.description ?? "",
      version: "1.0.0",
    };

    // Build content
    const frontmatterStr = serializeFrontmatter(frontmatter);
    const body = options.content ?? "";
    const fullContent = body.trim() ? `${frontmatterStr}\n\n${body}` : `${frontmatterStr}`;

    // Create directory and write file
    fs.mkdirSync(skillDir, { recursive: true });
    fs.writeFileSync(skillPath, fullContent, "utf-8");

    // Register in usage
    registerSkill(skillName, ns ?? null, "user");

    cliSuccess(`Skill "${fullName}" created at ${skillPath}`);
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to create skill");
    }
    process.exit(1);
  }
}
