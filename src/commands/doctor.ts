/**
 * Doctor Command
 *
 * `skm doctor` - Run health diagnostics on installed skills.
 * Detects duplicates, outdated skills, orphans, and conflicts.
 */

import { Command } from "commander";
import { runDoctor } from "../core/health/index.js";
import { cliError, cliResult, setOutputFormat, getOutputFormat, cliSuccess, cliWarn, cliInfo } from "../cli/messages.js";
import { formatTable } from "../cli/output.js";
import chalk from "chalk";

interface DoctorOptions {
  fix?: boolean;
  format?: "terminal" | "json";
}

export function registerDoctorCommand(program: Command): void {
  program
    .command("doctor")
    .description("Run health diagnostics on installed skills")
    .option("--fix", "Automatically fix issues where possible", false)
    .option("--format <format>", "Output format: terminal or json", "terminal")
    .action(handleDoctorAction);
}

export async function handleDoctorAction(options: DoctorOptions): Promise<void> {
  if (options.format) {
    setOutputFormat(options.format as "terminal" | "json");
  }

  try {
    await handleDoctor(options);
  } catch (error) {
    cliError((error as Error).message);
    process.exit(1);
  }
}

async function handleDoctor(options: DoctorOptions): Promise<void> {
  const rootPath = process.cwd();

  cliInfo(`Running health diagnostics on ${rootPath}...`);

  const report = await runDoctor(rootPath);

  const fmt = getOutputFormat();
  if (fmt === "json") {
    cliResult(report);
    return;
  }

  // Text output
  console.log(chalk.bold("\n📋 Health Report\n"));

  if (report.healthy) {
    cliSuccess("All health checks passed!");
    console.log("");
  }

  // Show summary
  console.log(chalk.bold("Summary:"));
  const summaryRows = [
    ["Total Issues", String(report.summary.total)],
    ["Errors", String(report.summary.bySeverity.error ?? 0)],
    ["Warnings", String(report.summary.bySeverity.warn ?? 0)],
    ["Info", String(report.summary.bySeverity.info ?? 0)],
  ];
  console.log(formatTable(["Metric", "Count"], summaryRows));

  if (report.issues.length === 0) {
    return;
  }

  console.log(chalk.bold("\nIssues:\n"));

  // Group issues by severity
  const errors = report.issues.filter((i) => i.severity === "error");
  const warnings = report.issues.filter((i) => i.severity === "warn");
  const infos = report.issues.filter((i) => i.severity === "info");

  if (errors.length > 0) {
    console.log(chalk.red.bold(`\n❌ Errors (${errors.length}):\n`));
    for (const issue of errors) {
      console.log(`  ${chalk.red("✖")} ${issue.message}`);
      if (issue.path) {
        console.log(`    ${chalk.gray(issue.path)}`);
      }
      if (issue.details && Object.keys(issue.details).length > 0) {
        console.log(`    ${chalk.gray(JSON.stringify(issue.details, null, 2))}`);
      }
    }
  }

  if (warnings.length > 0) {
    console.log(chalk.yellow.bold(`\n⚠️  Warnings (${warnings.length}):\n`));
    for (const issue of warnings) {
      console.log(`  ${chalk.yellow("⚠")} ${issue.message}`);
      if (issue.path) {
        console.log(`    ${chalk.gray(issue.path)}`);
      }
    }
  }

  if (infos.length > 0) {
    console.log(chalk.blue.bold(`\nℹ️  Info (${infos.length}):\n`));
    for (const issue of infos) {
      console.log(`  ${chalk.blue("ℹ")} ${issue.message}`);
      if (issue.path) {
        console.log(`    ${chalk.gray(issue.path)}`);
      }
    }
  }

  console.log("");

  // Handle fix option
  if (options.fix) {
    cliWarn("Auto-fix is not yet implemented");
    cliInfo("Please fix the issues manually");
  }
}
