import fs from "node:fs";
import path from "node:path";
import { homedir } from "node:os";
import type { NamespacedName } from "../namespace.js";
import { parseNamespacedName, skillDirPath } from "../namespace.js";
import { parseSkillMd } from "../skill-parser.js";

export interface LocalSkill {
  name: NamespacedName;
  frontmatter: {
    name: string;
    description: string;
    version?: string;
    metadata?: Record<string, unknown>;
  };
  body: string;
  filePath: string;
  source: "project" | "global";
}

export interface LocalSkillOptions {
  projectDir?: string;
  globalDir?: string;
}

export interface ListLocalOptions {
  includeProject?: boolean;
  includeGlobal?: boolean;
  namespace?: string;
}

const DEFAULT_PROJECT_DIR = ".claude/skills";
const DEFAULT_GLOBAL_DIR = path.join(homedir(), ".claude/skills");

export async function listLocalSkills(options: ListLocalOptions = {}): Promise<LocalSkill[]> {
  const {
    includeProject = true,
    includeGlobal = true,
    namespace,
  } = options;

  const skills: LocalSkill[] = [];

  if (includeProject) {
    const projectSkills = await scanDirectory(DEFAULT_PROJECT_DIR, "project", namespace);
    skills.push(...projectSkills);
  }

  if (includeGlobal) {
    const globalSkills = await scanDirectory(DEFAULT_GLOBAL_DIR, "global", namespace);
    skills.push(...globalSkills);
  }

  return skills;
}

async function scanDirectory(
  baseDir: string,
  source: "project" | "global",
  namespaceFilter?: string,
): Promise<LocalSkill[]> {
  const skills: LocalSkill[] = [];
  const resolvedBase = path.resolve(baseDir);

  if (!fs.existsSync(resolvedBase)) {
    return skills;
  }

  const entries = fs.readdirSync(resolvedBase, { withFileTypes: true });

  for (const entry of entries) {
    const entryPath = path.join(resolvedBase, entry.name);

    if (entry.isDirectory()) {
      const skillMdPath = path.join(entryPath, "SKILL.md");

      if (fs.existsSync(skillMdPath)) {
        const content = fs.readFileSync(skillMdPath, "utf-8");
        try {
          const parsed = parseSkillMd(content, skillMdPath);
          const namespaced = parseNamespacedName(entry.name);

          skills.push({
            name: namespaced,
            frontmatter: parsed.frontmatter,
            body: parsed.body,
            filePath: skillMdPath,
            source,
          });
        } catch {
          // Skip invalid skills
        }
      } else {
        const subSkills = await scanSubdirectory(entry.name, entryPath, source, namespaceFilter);
        skills.push(...subSkills);
      }
    }
  }

  if (namespaceFilter) {
    return skills.filter((s) => s.name.namespace === namespaceFilter);
  }

  return skills;
}

async function scanSubdirectory(
  namespace: string,
  dirPath: string,
  source: "project" | "global",
  namespaceFilter?: string,
): Promise<LocalSkill[]> {
  const skills: LocalSkill[] = [];

  if (namespaceFilter && namespace !== namespaceFilter) {
    return skills;
  }

  const entries = fs.readdirSync(dirPath, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const skillMdPath = path.join(dirPath, entry.name, "SKILL.md");
    if (fs.existsSync(skillMdPath)) {
      const content = fs.readFileSync(skillMdPath, "utf-8");
      try {
        const parsed = parseSkillMd(content, skillMdPath);
        const namespaced = parseNamespacedName(`${namespace}:${entry.name}`);

        skills.push({
          name: namespaced,
          frontmatter: parsed.frontmatter,
          body: parsed.body,
          filePath: skillMdPath,
          source,
        });
      } catch {
        // Skip invalid skills
      }
    }
  }

  return skills;
}

export async function getLocalSkill(
  name: string,
  options: LocalSkillOptions = {},
): Promise<LocalSkill | null> {
  const { projectDir = DEFAULT_PROJECT_DIR, globalDir = DEFAULT_GLOBAL_DIR } = options;

  const namespaced = parseNamespacedName(name);
  const dirPath = skillDirPath(namespaced, projectDir);

  const skillMdPath = path.join(dirPath, "SKILL.md");
  if (fs.existsSync(skillMdPath)) {
    const content = fs.readFileSync(skillMdPath, "utf-8");
    try {
      const parsed = parseSkillMd(content, skillMdPath);
      return {
        name: namespaced,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        filePath: skillMdPath,
        source: "project",
      };
    } catch {
      // Continue to global
    }
  }

  const globalPath = skillDirPath(namespaced, globalDir);
  const globalSkillMdPath = path.join(globalPath, "SKILL.md");
  if (fs.existsSync(globalSkillMdPath)) {
    const content = fs.readFileSync(globalSkillMdPath, "utf-8");
    try {
      const parsed = parseSkillMd(content, globalSkillMdPath);
      return {
        name: namespaced,
        frontmatter: parsed.frontmatter,
        body: parsed.body,
        filePath: globalSkillMdPath,
        source: "global",
      };
    } catch {
      return null;
    }
  }

  return null;
}

export function listNamespaces(options: ListLocalOptions = {}): string[] {
  const {
    includeProject = true,
    includeGlobal = true,
  } = options;

  const namespaces = new Set<string>();

  const scanDir = (baseDir: string) => {
    const resolvedBase = path.resolve(baseDir);
    if (!fs.existsSync(resolvedBase)) return;

    const entries = fs.readdirSync(resolvedBase, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const skillMdPath = path.join(resolvedBase, entry.name, "SKILL.md");
        if (fs.existsSync(skillMdPath)) {
          continue; // No namespace
        }
        // Check if it has subdirs with SKILL.md
        const subPath = path.join(resolvedBase, entry.name);
        const subEntries = fs.readdirSync(subPath, { withFileTypes: true });
        for (const sub of subEntries) {
          if (sub.isDirectory()) {
            const subSkillMd = path.join(subPath, sub.name, "SKILL.md");
            if (fs.existsSync(subSkillMd)) {
              namespaces.add(entry.name);
              break;
            }
          }
        }
      }
    }
  };

  if (includeProject) {
    scanDir(DEFAULT_PROJECT_DIR);
  }
  if (includeGlobal) {
    scanDir(DEFAULT_GLOBAL_DIR);
  }

  return Array.from(namespaces).sort();
}
