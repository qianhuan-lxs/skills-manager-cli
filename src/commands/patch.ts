import fs from "node:fs";
import { getLocalSkill } from "../core/discovery/local.js";
import { incrementPatchCount } from "../core/usage.js";
import { cliSuccess, cliError } from "../cli/messages.js";

interface PatchOptions {
  old?: string;
  new?: string;
  replaceAll?: boolean;
}

export async function handlePatchAction(name: string, options: PatchOptions): Promise<void> {
  try {
    if (!options.old || !options.new) {
      cliError("--old and --new options are required");
      process.exit(1);
    }

    // Find skill
    const skill = await getLocalSkill(name);
    if (!skill) {
      cliError(`Skill "${name}" not found`);
      process.exit(1);
    }

    // Read file content
    const content = fs.readFileSync(skill.filePath, "utf-8");

    // Check if old string exists
    if (!content.includes(options.old)) {
      cliError(`String "${options.old}" not found in ${skill.filePath}`);
      process.exit(1);
    }

    // Perform replacement
    let newContent: string;
    if (options.replaceAll) {
      const count = (content.match(new RegExp(escapeRegExp(options.old), "g")))?.length ?? 0;
      newContent = content.split(options.old).join(options.new);
      cliSuccess(`Replaced ${count} occurrence(s) in ${skill.filePath}`);
    } else {
      const firstIndex = content.indexOf(options.old);
      newContent = content.slice(0, firstIndex) + options.new + content.slice(firstIndex + options.old.length);
      cliSuccess(`Replaced 1 occurrence in ${skill.filePath}`);
    }

    // Write back
    fs.writeFileSync(skill.filePath, newContent, "utf-8");

    // Increment patch count
    incrementPatchCount(name);
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to patch skill");
    }
    process.exit(1);
  }
}

function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
