import type { HealthIssue, HealthReport, SkillInfo } from "./types.js";
import { parseSkillMd } from "../skill-parser.js";
import { glob } from "glob";
import { promises as fs } from "node:fs";

export function detectDuplicates(skills: SkillInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const seenNames = new Map<string, SkillInfo[]>();

  for (const skill of skills) {
    if (!seenNames.has(skill.name)) {
      seenNames.set(skill.name, []);
    }
    seenNames.get(skill.name)!.push(skill);
  }

  for (const [name, duplicates] of seenNames) {
    if (duplicates.length > 1) {
      issues.push({
        type: "duplicate",
        severity: "error",
        message: `Duplicate skill name: "${name}" found in ${duplicates.length} locations`,
        details: {
          name,
          paths: duplicates.map((d) => d.path),
        },
      });
    }
  }

  return issues;
}

export function detectOutdated(skills: SkillInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const now = Date.now();
  const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
  const NINETY_DAYS_MS = 90 * 24 * 60 * 60 * 1000;

  for (const skill of skills) {
    const age = now - skill.mtime;

    if (age > NINETY_DAYS_MS) {
      issues.push({
        type: "outdated",
        severity: "info",
        message: `Skill "${skill.name}" hasn't been modified in >90 days`,
        path: skill.path,
        details: {
          name: skill.name,
          daysSinceModified: Math.floor(age / (24 * 60 * 60 * 1000)),
        },
      });
    } else if (age > THIRTY_DAYS_MS) {
      issues.push({
        type: "outdated",
        severity: "info",
        message: `Skill "${skill.name}" hasn't been modified in >30 days`,
        path: skill.path,
        details: {
          name: skill.name,
          daysSinceModified: Math.floor(age / (24 * 60 * 60 * 1000)),
        },
      });
    }
  }

  return issues;
}

export function detectOrphans(skills: SkillInfo[], knownPaths: string[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const skillPathSet = new Set(skills.map((s) => s.path));

  for (const path of knownPaths) {
    if (!skillPathSet.has(path)) {
      issues.push({
        type: "orphan",
        severity: "warn",
        message: `Orphaned SKILL.md file: "${path}"`,
        path,
        details: { path },
      });
    }
  }

  return issues;
}

export function detectConflicts(skills: SkillInfo[]): HealthIssue[] {
  const issues: HealthIssue[] = [];
  const seenPatterns = new Map<string, SkillInfo[]>();

  // Detect similar names (potential typos/conflicts)
  for (const skill of skills) {
    const normalized = skill.name.toLowerCase().replace(/[-_\s]/g, "");

    if (!seenPatterns.has(normalized)) {
      seenPatterns.set(normalized, []);
    }
    seenPatterns.get(normalized)!.push(skill);
  }

  for (const [normalized, candidates] of seenPatterns) {
    if (candidates.length > 1) {
      const names = candidates.map((c) => c.name);
      // Only flag if names are actually different (not exact duplicates)
      const uniqueNames = new Set(names);
      if (uniqueNames.size > 1) {
        issues.push({
          type: "conflict",
          severity: "warn",
          message: `Potentially conflicting skill names: ${Array.from(uniqueNames).join(", ")}`,
          details: {
            names: Array.from(uniqueNames),
            normalized,
          },
        });
      }
    }
  }

  // Detect version conflicts for same-named skills
  const byName = new Map<string, SkillInfo[]>();
  for (const skill of skills) {
    if (!byName.has(skill.name)) {
      byName.set(skill.name, []);
    }
    byName.get(skill.name)!.push(skill);
  }

  for (const [name, versions] of byName) {
    if (versions.length > 1) {
      const uniqueVersions = new Set(versions.map((v) => v.version || "unversioned"));
      if (uniqueVersions.size > 1) {
        issues.push({
          type: "conflict",
          severity: "error",
          message: `Skill "${name}" has multiple versions: ${Array.from(uniqueVersions).join(", ")}`,
          details: {
            name,
            versions: Array.from(uniqueVersions),
            paths: versions.map((v) => v.path),
          },
        });
      }
    }
  }

  return issues;
}

export async function runDoctor(rootPath: string): Promise<HealthReport> {
  const issues: HealthIssue[] = [];

  try {
    // Find all SKILL.md files
    const skillFiles = await glob("**/SKILL.md", {
      cwd: rootPath,
      absolute: true,
      ignore: ["**/node_modules/**", "**/dist/**", "**/.git/**"],
    });

    // Parse all skills
    const skills: SkillInfo[] = [];
    const parseErrors: HealthIssue[] = [];

    for (const filePath of skillFiles) {
      try {
        const content = await fs.readFile(filePath, "utf-8");
        const parsed = parseSkillMd(content, filePath);
        const stats = await fs.stat(filePath);

        skills.push({
          path: filePath,
          name: parsed.frontmatter.name,
          description: parsed.frontmatter.description,
          version: parsed.frontmatter.version as string | undefined,
          namespace: parsed.frontmatter.namespace as string | undefined,
          mtime: stats.mtimeMs,
        });
      } catch (e) {
        parseErrors.push({
          type: "error",
          severity: "error",
          message: `Failed to parse SKILL.md: ${(e as Error).message}`,
          path: filePath,
        });
      }
    }

    issues.push(...parseErrors);

    // Run all health checks
    issues.push(...detectDuplicates(skills));
    issues.push(...detectOutdated(skills));
    issues.push(...detectOrphans(skills, skillFiles));
    issues.push(...detectConflicts(skills));

    // Build summary
    const summary = {
      total: issues.length,
      byType: {} as Record<string, number>,
      bySeverity: {} as Record<string, number>,
    };

    for (const issue of issues) {
      summary.byType[issue.type] = (summary.byType[issue.type] ?? 0) + 1;
      summary.bySeverity[issue.severity] = (summary.bySeverity[issue.severity] ?? 0) + 1;
    }

    return {
      issues,
      summary,
      healthy: issues.filter((i) => i.severity === "error").length === 0,
    };
  } catch (e) {
    return {
      issues: [
        {
          type: "error",
          severity: "error",
          message: `Doctor failed: ${(e as Error).message}`,
        },
      ],
      summary: {
        total: 1,
        byType: { error: 1 },
        bySeverity: { error: 1 },
      },
      healthy: false,
    };
  }
}

export * from "./types.js";
