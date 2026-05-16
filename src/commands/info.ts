import { Command } from "commander";
import chalk from "chalk";
import {
  getLocalSkill,
  getRegistrySkill,
  getGitHubSkill,
  type LocalSkill,
  type RegistrySkill,
  type GitHubSkill,
} from "../core/discovery/index.js";
import { cliError, cliResult, setOutputFormat, getOutputFormat } from "../cli/messages.js";
import { parseNamespacedName } from "../core/namespace.js";

interface InfoOptions {
  source?: "local" | "registry" | "github" | "auto";
  format?: string;
}

function isLocalSkill(skill: LocalSkill | RegistrySkill | GitHubSkill): skill is LocalSkill {
  return "frontmatter" in skill;
}

function isRegistrySkill(skill: LocalSkill | RegistrySkill | GitHubSkill): skill is RegistrySkill {
  return skill.source === "registry";
}

function isGitHubSkill(skill: LocalSkill | RegistrySkill | GitHubSkill): skill is GitHubSkill {
  return skill.source === "github";
}

function skillDisplayName(skill: LocalSkill | RegistrySkill | GitHubSkill): string {
  if (isLocalSkill(skill)) {
    return skill.name.namespace ? `${skill.name.namespace}/` : "" + skill.name.name;
  }
  const ns = isGitHubSkill(skill) && skill.namespace ? skill.namespace + "/" : "";
  return ns + skill.name;
}

function skillDescription(skill: LocalSkill | RegistrySkill | GitHubSkill): string {
  if (isLocalSkill(skill)) {
    return skill.frontmatter.description ?? "";
  }
  return skill.description ?? "";
}

export function registerInfoCommand(program: Command): void {
  program
    .command("info <name>")
    .description("Display detailed information about a skill")
    .option("-s, --source <source>", "Skill source: local, registry, github, or auto", "auto")
    .option("-f, --format <format>", "Output format: terminal, json, markdown", "terminal")
    .action(handleInfoAction);
}

export async function handleInfoAction(name: string, options: InfoOptions): Promise<void> {
  if (options.format) {
    setOutputFormat(options.format as "terminal" | "json" | "markdown");
  }

  try {
    await handleInfo(name, options);
  } catch (error) {
    cliError((error as Error).message);
    process.exit(1);
  }
}

async function handleInfo(name: string, options: InfoOptions): Promise<void> {
  const { source = "auto" } = options;
  const parsed = parseNamespacedName(name);

  let skill: LocalSkill | RegistrySkill | GitHubSkill | null = null;
  let foundSource: string | undefined;

  if (source === "auto" || source === "local") {
    skill = await getLocalSkill(name);
    if (skill) foundSource = "local";
  }

  if (!skill && (source === "auto" || source === "registry")) {
    skill = await getRegistrySkill(name);
    if (skill) foundSource = "registry";
  }

  if (!skill && (source === "auto" || source === "github")) {
    const [owner, repo] = name.includes("/")
      ? name.split("/")
      : [parsed.namespace ?? "anthropics", parsed.name];
    skill = await getGitHubSkill(owner, repo);
    if (skill) foundSource = "github";
  }

  if (!skill) {
    cliError(`Skill "${name}" not found`);
    process.exit(1);
  }

  const fmt = getOutputFormat();
  if (fmt === "json") {
    cliResult({ ...skill, source: foundSource });
    return;
  }

  if (fmt === "markdown") {
    console.log(formatSkillMarkdown(skill, foundSource));
    return;
  }

  console.log(formatSkillTerminal(skill, foundSource));
}

function formatSkillTerminal(
  skill: LocalSkill | RegistrySkill | GitHubSkill,
  source?: string,
): string {
  const lines: string[] = [];

  lines.push("");
  lines.push(chalk.bold.cyan(skillDisplayName(skill)));
  if (source) {
    lines.push(chalk.gray(`Source: ${source}`));
  }
  lines.push("");

  const description = skillDescription(skill);
  if (description) {
    lines.push(chalk.bold("Description:"));
    lines.push(`  ${description}`);
    lines.push("");
  }

  if (isLocalSkill(skill)) {
    if (skill.frontmatter?.version) {
      lines.push(`${chalk.bold("Version:")} ${skill.frontmatter.version}`);
    }
  } else if (isRegistrySkill(skill)) {
    if (skill.version) {
      lines.push(`${chalk.bold("Version:")} ${skill.version}`);
    }
    if (skill.author) {
      lines.push(`${chalk.bold("Author:")} ${skill.author}`);
    }
    if (skill.repository) {
      lines.push(`${chalk.bold("Repository:")} ${chalk.blue(skill.repository)}`);
    }
    if (skill.homepage) {
      lines.push(`${chalk.bold("Homepage:")} ${chalk.blue(skill.homepage)}`);
    }
  }

  if ("stars" in skill && skill.stars !== undefined) {
    lines.push(`${chalk.bold("Stars:")} ${chalk.yellow(String(skill.stars))}`);
  }

  if ("downloads" in skill && skill.downloads !== undefined) {
    lines.push(`${chalk.bold("Downloads:")} ${skill.downloads}`);
  }

  if ("rating" in skill && skill.rating !== undefined) {
    lines.push(`${chalk.bold("Rating:")} ${"★".repeat(Math.round(skill.rating / 20))}${skill.rating}/100`);
  }

  if ("tags" in skill && skill.tags && skill.tags.length > 0) {
    lines.push(`${chalk.bold("Tags:")} ${skill.tags.map((t) => chalk.cyan(`#${t}`)).join(" ")}`);
  }

  if ("language" in skill && skill.language) {
    lines.push(`${chalk.bold("Language:")} ${skill.language}`);
  }

  if (isLocalSkill(skill) && skill.body) {
    lines.push("");
    lines.push(chalk.bold("Documentation:"));
    const bodyLines = skill.body.split("\n").slice(0, 20);
    lines.push(bodyLines.map((l) => `  ${l}`).join("\n"));
    if (skill.body.split("\n").length > 20) {
      lines.push(chalk.gray("  ... (truncated)"));
    }
  }

  if (isLocalSkill(skill) && skill.filePath) {
    lines.push("");
    lines.push(`${chalk.bold("File:")} ${skill.filePath}`);
  }

  if ("createdAt" in skill && skill.createdAt) {
    lines.push(`${chalk.bold("Created:")} ${new Date(skill.createdAt).toLocaleDateString()}`);
  }

  if ("updatedAt" in skill && skill.updatedAt) {
    lines.push(`${chalk.bold("Updated:")} ${new Date(skill.updatedAt).toLocaleDateString()}`);
  }

  lines.push("");
  return lines.join("\n");
}

function formatSkillMarkdown(
  skill: LocalSkill | RegistrySkill | GitHubSkill,
  source?: string,
): string {
  const lines: string[] = [];

  lines.push(`# ${skillDisplayName(skill)}`);
  if (source) {
    lines.push(`\n*Source: ${source}*\n`);
  }

  const description = skillDescription(skill);
  if (description) {
    lines.push(`\n${description}\n`);
  }

  lines.push("## Details\n");
  lines.push("| Field | Value |");
  lines.push("|-------|-------|");

  if (isLocalSkill(skill)) {
    if (skill.frontmatter?.version) {
      lines.push(`| Version | ${skill.frontmatter.version} |`);
    }
  } else if (isRegistrySkill(skill)) {
    if (skill.version) {
      lines.push(`| Version | ${skill.version} |`);
    }
    if (skill.author) {
      lines.push(`| Author | ${skill.author} |`);
    }
    if (skill.repository) {
      lines.push(`| Repository | [${skill.repository}](${skill.repository}) |`);
    }
    if (skill.homepage) {
      lines.push(`| Homepage | [${skill.homepage}](${skill.homepage}) |`);
    }
  }

  if ("stars" in skill && skill.stars !== undefined) {
    lines.push(`| Stars | ${skill.stars} |`);
  }

  if ("downloads" in skill && skill.downloads !== undefined) {
    lines.push(`| Downloads | ${skill.downloads} |`);
  }

  if ("rating" in skill && skill.rating !== undefined) {
    lines.push(`| Rating | ${skill.rating}/100 |`);
  }

  if ("tags" in skill && skill.tags && skill.tags.length > 0) {
    lines.push(`| Tags | ${skill.tags.join(", ")} |`);
  }

  if ("language" in skill && skill.language) {
    lines.push(`| Language | ${skill.language} |`);
  }

  if (isLocalSkill(skill) && skill.filePath) {
    lines.push(`| File | \`${skill.filePath}\` |`);
  }

  if ("createdAt" in skill && skill.createdAt) {
    lines.push(`| Created | ${new Date(skill.createdAt).toISOString()} |`);
  }

  if ("updatedAt" in skill && skill.updatedAt) {
    lines.push(`| Updated | ${new Date(skill.updatedAt).toISOString()} |`);
  }

  if (isLocalSkill(skill) && skill.body) {
    lines.push("\n## Documentation\n");
    lines.push("```");
    lines.push(skill.body);
    lines.push("```");
  }

  return lines.join("\n");
}
