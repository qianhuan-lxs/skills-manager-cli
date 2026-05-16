/**
 * Scan Command
 *
 * `skm scan` - Scan skills for security issues.
 * Supports scanning individual skill files or directories.
 */

import { Command } from "commander";
import { promises as fs } from "node:fs";
import path from "node:path";
import { glob } from "glob";
import { ScanEngine } from "../core/scanner/engine.js";
import { parseSkillMd } from "../core/skill-parser.js";
import { cliError, cliResult, setOutputFormat, getOutputFormat } from "../cli/messages.js";
import { formatRiskScore } from "../cli/output.js";
import chalk from "chalk";

interface ScanOptions {
  severity?: "error" | "warn" | "info";
  format?: "terminal" | "json";
  json?: boolean;
}

export function registerScanCommand(program: Command): void {
  program
    .command("scan [path]")
    .description("Scan skills for security and safety issues")
    .option("--severity <level>", "Minimum severity level: error, warn, info", "info")
    .option("--format <format>", "Output format: terminal or json", "terminal")
    .option("--json", "Output as JSON (shorthand for --format json)", false)
    .action(handleScanAction);
}

export async function handleScanAction(targetPath: string | undefined, options: ScanOptions): Promise<void> {
  // Handle JSON shorthand
  const format = options.json === true ? "json" : options.format;
  if (format) {
    setOutputFormat(format as "terminal" | "json");
  }

  try {
    await handleScan(targetPath, options);
  } catch (error) {
    cliError((error as Error).message);
    process.exit(1);
  }
}

async function handleScan(targetPath: string | undefined, options: ScanOptions): Promise<void> {
  const minSeverity = options.severity ?? "info";
  const severityOrder: Record<string, number> = { error: 3, warn: 2, info: 1 };
  const minLevel = severityOrder[minSeverity] ?? 1;

  // Determine paths to scan
  const scanPaths = await resolveScanPaths(targetPath);

  if (scanPaths.length === 0) {
    cliError("No skill files found to scan");
    process.exit(1);
  }

  const engine = new ScanEngine();
  const allResults: Array<{
    path: string;
    result: { findings: unknown[]; riskScore: number; summary: { error: number; warn: number; info: number } };
  }> = [];

  for (const filePath of scanPaths) {
    try {
      const content = await fs.readFile(filePath, "utf-8");
      const parsed = parseSkillMd(content, filePath);

      const scanResult = engine.scan(content, parsed.frontmatter);

      // Filter findings by severity
      const filteredFindings = scanResult.findings.filter(
        (f) => (severityOrder[f.severity] ?? 0) >= minLevel,
      );

      if (filteredFindings.length > 0 || minLevel === 1) {
        allResults.push({
          path: filePath,
          result: {
            findings: filteredFindings,
            riskScore: scanResult.riskScore,
            summary: scanResult.summary,
          },
        });
      }
    } catch (error) {
      cliError(`Failed to scan ${filePath}: ${(error as Error).message}`);
    }
  }

  // Output results
  const fmt = getOutputFormat();
  if (fmt === "json") {
    cliResult({ scanned: scanPaths.length, results: allResults });
    return;
  }

  // Text output
  console.log(chalk.bold(`\nScanned ${scanPaths.length} skill file(s)\n`));

  if (allResults.length === 0) {
    console.log(chalk.green("✓ No issues found"));
    return;
  }

  let totalIssues = 0;
  for (const { path: filePath, result } of allResults) {
    if (result.findings.length === 0) continue;

    totalIssues += result.findings.length;
    console.log(chalk.bold.cyan(`\n${path.relative(process.cwd(), filePath)}`));
    console.log(`  Risk Score: ${formatRiskScore(result.riskScore)}`);
    console.log(`  Issues: ${result.summary.error} errors, ${result.summary.warn} warnings, ${result.summary.info} info\n`);

    for (const finding of result.findings as Array<{ severity: string; message: string; line?: number; snippet?: string }>) {
      const icon = finding.severity === "error" ? chalk.red("✖") : finding.severity === "warn" ? chalk.yellow("⚠") : chalk.blue("ℹ");
      const lineInfo = finding.line ? `:${finding.line}` : "";
      console.log(`  ${icon} ${chalk.bold(finding.severity.toUpperCase())}${lineInfo}: ${finding.message}`);
      if (finding.snippet) {
        console.log(`    ${chalk.gray(finding.snippet.trim())}`);
      }
    }
  }

  console.log(chalk.bold(`\nTotal: ${totalIssues} issue(s) found\n`));
}

async function resolveScanPaths(targetPath: string | undefined): Promise<string[]> {
  if (targetPath) {
    const resolved = path.resolve(targetPath);
    const stat = await fs.stat(resolved).catch(() => null);

    if (!stat) {
      cliError(`Path not found: ${targetPath}`);
      process.exit(1);
    }

    if (stat.isFile()) {
      return [resolved];
    }

    if (stat.isDirectory()) {
      const skillFiles = await glob("**/SKILL.md", {
        cwd: resolved,
        absolute: true,
        ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
      });
      return skillFiles;
    }
  }

  // Default: scan current working directory for SKILL.md files
  const skillFiles = await glob("**/SKILL.md", {
    cwd: process.cwd(),
    absolute: true,
    ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
  });

  return skillFiles;
}
