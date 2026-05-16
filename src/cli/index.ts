#!/usr/bin/env node
import { Command } from "commander";
import { createLazyAction } from "./lazy-action.js";

const program = new Command();

program
  .name("skm")
  .description("AI coding agent skill lifecycle management CLI")
  .version("0.1.0");

// --- Lazy-loaded Commands ---

program
  .command("search [query]")
  .description("Search for Claude skills from local, registry, or GitHub sources")
  .option("-n, --namespace <ns>", "Filter by namespace")
  .option("--list-namespaces", "List available namespaces")
  .option("--local", "Search only local skills")
  .option("-s, --source <source>", "Search source: local, registry, github, or all", "all")
  .option("--sort <field>", "Sort by: name, updated, stars, downloads", "name")
  .option("--limit <num>", "Limit results", "20")
  .option("--offset <num>", "Offset for pagination", "0")
  .option("-i, --interactive", "Interactive search mode")
  .action(createLazyAction(() => import("../commands/search.js") as unknown as Promise<Record<string, () => Promise<void>>>, "handleSearchAction"));

program
  .command("info <name>")
  .description("Display detailed information about a skill")
  .option("-s, --source <source>", "Skill source: local, registry, github, or auto", "auto")
  .option("-f, --format <format>", "Output format: terminal, json, markdown", "terminal")
  .action(createLazyAction(() => import("../commands/info.js") as unknown as Promise<Record<string, () => Promise<void>>>, "handleInfoAction"));

program
  .command("scan [path]")
  .description("Scan skills for security and safety issues")
  .option("--severity <level>", "Minimum severity level: error, warn, info", "info")
  .option("--format <format>", "Output format: terminal or json", "terminal")
  .option("--json", "Output as JSON (shorthand for --format json)", false)
  .action(createLazyAction(() => import("../commands/scan.js") as unknown as Promise<Record<string, () => Promise<void>>>, "handleScanAction"));

program
  .command("doctor")
  .description("Run health diagnostics on installed skills")
  .option("--fix", "Automatically fix issues where possible", false)
  .option("--format <format>", "Output format: terminal or json", "terminal")
  .action(createLazyAction(() => import("../commands/doctor.js") as unknown as Promise<Record<string, () => Promise<void>>>, "handleDoctorAction"));

// Config uses subcommands, registered directly
import { registerConfigCommand } from "../commands/config.js";
registerConfigCommand(program);

// Serve command registered directly (MCP server, needs fast startup)
import { registerServeCommand } from "../commands/serve.js";
registerServeCommand(program);

// --- Stub Commands (not yet implemented) ---

program
  .command("generate")
  .description("Auto-generate skills using LLM")
  .option("--from-session", "Extract skill from latest Claude Code session")
  .option("--from-issue <ref>", "Generate from GitHub issue (owner/repo#123)")
  .option("--from-pr <ref>", "Generate from GitHub PR (owner/repo#456)")
  .option("--from-prompt <path>", "Convert a prompt file into a skill")
  .option("-i, --interactive", "Interactive skill creation mode")
  .option("--namespace <ns>", "Target namespace", "skm")
  .option("--base-url <url>", "LLM API base URL override")
  .option("--api-key <key>", "LLM API key override")
  .option("--model <model>", "LLM model override")
  .action(
    createLazyAction(
      () =>
        import("../commands/generate.js") as unknown as Promise<
          Record<string, (...a: unknown[]) => Promise<void>>
        >,
      "handleGenerateAction",
    ),
  );

program
  .command("create <name>")
  .description("Create a new skill")
  .option("--description <desc>", "Description for the skill")
  .option("--namespace <ns>", "Namespace for the skill")
  .option("--content <body>", "Initial content/body for the skill")
  .action(createLazyAction(() => import("../commands/create.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleCreateAction"));

program
  .command("patch <name>")
  .description("Patch an existing skill (string replace)")
  .option("--old <string>", "String to replace")
  .option("--new <string>", "Replacement string")
  .option("--replace-all", "Replace all occurrences", false)
  .action(createLazyAction(() => import("../commands/patch.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handlePatchAction"));

program
  .command("delete <name>")
  .description("Delete a skill")
  .option("--absorbed-into <name>", "Name of skill that absorbed this one")
  .option("--force", "Skip confirmation prompt", false)
  .action(createLazyAction(() => import("../commands/delete.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleDeleteAction"));

program.command("review").description("Review session for skill creation")
  .option("--session <path>", "Path to specific session file")
  .option("--auto-apply", "Auto-create suggested skills")
  .action(createLazyAction(() => import("../commands/review.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleReviewAction"));

program.command("evolve").description("Run skill evolution (Curator)")
  .option("--dry-run", "Show suggestions without applying")
  .option("--skill <name>", "Evolve a specific skill")
  .action(createLazyAction(() => import("../commands/evolve.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleEvolveAction"));

program.command("tick").description("Increment iteration counter (hook call)")
  .action(createLazyAction(() => import("../commands/tick.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleTickAction"));

program.command("hooks").description("Manage Claude Code hooks for skm")
  .option("--install", "Install hooks into .claude/settings.json")
  .option("--uninstall", "Remove skm hooks from settings.json")
  .action(createLazyAction(() => import("../commands/hooks.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleHooksAction"));

program
  .command("init")
  .description("Initialize skm configuration")
  .action(createLazyAction(() => import("../commands/init.js") as unknown as Promise<Record<string, (...a: unknown[]) => Promise<void>>>, "handleInitAction"));

program.parse();
