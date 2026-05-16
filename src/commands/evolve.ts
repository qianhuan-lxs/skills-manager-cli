import fs from "node:fs";
import path from "node:path";
import { confirm } from "@clack/prompts";
import { runCurator, evolveSkill } from "../core/evolution/index.js";
import { cliInfo, cliSuccess, cliError } from "../cli/messages.js";

interface EvolveOptions {
  dryRun?: boolean;
  skill?: string;
}

async function showDiff(original: string, improved: string): Promise<void> {
  // Simple diff display
  const lines1 = original.split("\n");
  const lines2 = improved.split("\n");

  console.log("\n--- Changes ---");
  for (let i = 0; i < Math.max(lines1.length, lines2.length); i++) {
    const line1 = lines1[i] ?? "";
    const line2 = lines2[i] ?? "";
    if (line1 !== line2) {
      console.log(`- ${line1}`);
      console.log(`+ ${line2}`);
    }
  }
  console.log("---\n");
}

async function evolveSingleSkill(skillName: string): Promise<void> {
  const SKM_BASE_DIR = path.join(process.env.HOME ?? process.env.USERPROFILE ?? "", ".skm", "skills");
  const skillPath = path.join(SKM_BASE_DIR, skillName.replace(":", "/"), "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    cliError(`Skill not found: ${skillName}`);
    return;
  }

  const originalContent = fs.readFileSync(skillPath, "utf-8");

  cliInfo(`Analyzing skill: ${skillName}`);

  try {
    const improvedContent = await evolveSkill(skillName);

    if (!improvedContent) {
      cliInfo("No improvements suggested for this skill.");
      return;
    }

    await showDiff(originalContent, improvedContent);

    const shouldApply = await confirm({
      message: "Apply these improvements?",
    });

    if (shouldApply) {
      fs.writeFileSync(skillPath, improvedContent, "utf-8");
      cliSuccess(`Skill updated: ${skillPath}`);
    } else {
      cliInfo("Changes discarded.");
    }
  } catch (error) {
    cliError(`Failed to evolve skill: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function runCuratorWithOptions(dryRun: boolean): Promise<void> {
  cliInfo("Running skill evolution curator...");

  try {
    const suggestions = await runCurator({ dryRun });

    if (suggestions.length === 0) {
      cliInfo("No evolution suggestions found.");
      return;
    }

    cliInfo(`\nFound ${suggestions.length} suggestion(s):\n`);

    for (const suggestion of suggestions) {
      const skills = suggestion.skills.join(", ");
      cliInfo(`${suggestion.action.toUpperCase()}: ${skills}`);
      cliInfo(`  Reason: ${suggestion.reason}`);
    }

    if (!dryRun) {
      const shouldApply = await confirm({
        message: "Apply these changes?",
      });

      if (shouldApply) {
        cliSuccess("Evolution changes applied.");
      } else {
        cliInfo("Changes discarded.");
      }
    }
  } catch (error) {
    cliError(`Curator failed: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function handleEvolveAction(options: EvolveOptions = {}): Promise<void> {
  if (options.skill) {
    await evolveSingleSkill(options.skill);
  } else {
    await runCuratorWithOptions(options.dryRun ?? false);
  }
}
