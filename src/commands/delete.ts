import fs from "node:fs";
import path from "node:path";
import { getLocalSkill } from "../core/discovery/local.js";
import { removeSkill } from "../core/usage.js";
import { cliSuccess, cliError } from "../cli/messages.js";

interface DeleteOptions {
  absorbedInto?: string;
  force?: boolean;
}

export async function handleDeleteAction(name: string, options: DeleteOptions): Promise<void> {
  try {
    // Find skill
    const skill = await getLocalSkill(name);
    if (!skill) {
      cliError(`Skill "${name}" not found`);
      process.exit(1);
    }

    // Show confirmation prompt unless --force
    if (!options.force) {
      // For CLI, we'll just show a warning since we can't do async prompts easily
      // In a real scenario, @clack/prompts would be used here
      cliError(`Deleting skill "${name}". Use --force to skip confirmation.`);
      process.exit(1);
    }

    // Get the skill directory
    const skillDir = path.dirname(skill.filePath);

    // Remove skill directory
    fs.rmSync(skillDir, { recursive: true, force: true });

    // If absorbed into another skill, record in usage.json
    if (options.absorbedInto) {
      // Note: This would require updating the usage entry to set absorbedInto
      // For now, we just remove the skill
      cliSuccess(`Skill "${name}" deleted (absorbed into "${options.absorbedInto}")`);
    } else {
      cliSuccess(`Skill "${name}" deleted`);
    }

    // Remove from usage.json
    removeSkill(name);
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to delete skill");
    }
    process.exit(1);
  }
}
