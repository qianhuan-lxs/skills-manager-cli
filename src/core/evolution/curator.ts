import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { loadUsage, saveUsage, type SkillUsageEntry } from "../usage.js";
import { listLocalSkills } from "../discovery/local.js";
import { generateWithLlm } from "../generator/llm-client.js";

export type CuratorAction = "archive" | "merge" | "evolve";

export interface CuratorSuggestion {
  action: CuratorAction;
  skills: string[];
  reason: string;
}

export interface CuratorOptions {
  dryRun?: boolean;
  staleAfterDays?: number;
  minUseCount?: number;
}

const CURATOR_PROMPT = `You are a skill curator. Your task is to suggest improvements for a skill based on its usage and content.

Analyze the skill and suggest specific improvements:
- Better descriptions or naming
- Missing edge cases to handle
- Additional examples that would help users
- Related patterns that could be consolidated

Return a JSON object with:
{
  "improvements": ["specific improvement suggestion 1", "suggestion 2", ...],
  "evolvedContent": "full improved SKILL.md content with frontmatter and body"
}

If no significant improvements are needed, return { "improvements": [], "evolvedContent": null }.`;

function isStale(entry: SkillUsageEntry, staleAfterDays: number): boolean {
  const lastUsed = new Date(entry.lastUsedAt);
  const now = new Date();
  const daysSinceLastUse = (now.getTime() - lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  return daysSinceLastUse > staleAfterDays;
}

function similarity(str1: string, str2: string): number {
  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
  const s1 = normalize(str1);
  const s2 = normalize(str2);

  if (s1 === s2) return 1;

  // Simple Jaccard similarity on word sets
  const words1 = new Set(s1.split(/(?=[A-Z])|[^a-zA-Z0-9]/).filter(Boolean));
  const words2 = new Set(s2.split(/(?=[A-Z])|[^a-zA-Z0-9]/).filter(Boolean));

  const intersection = new Set([...words1].filter((x) => words2.has(x)));
  const union = new Set([...words1, ...words2]);

  return union.size === 0 ? 0 : intersection.size / union.size;
}

async function findMergeCandidates(
  agentSkills: SkillUsageEntry[],
  localSkills: Awaited<ReturnType<typeof listLocalSkills>>,
): Promise<string[][]> {
  const candidates: string[][] = [];
  const processed = new Set<string>();

  for (const skill1 of agentSkills) {
    if (processed.has(skill1.name)) continue;

    const fullName1 = skill1.namespace ? `${skill1.namespace}:${skill1.name}` : skill1.name;
    const local1 = localSkills.find((s) => s.name.fullName === fullName1);

    if (!local1) continue;

    const similar: string[] = [fullName1];

    for (const skill2 of agentSkills) {
      if (skill1.name === skill2.name) continue;
      if (processed.has(skill2.name)) continue;

      const fullName2 = skill2.namespace ? `${skill2.namespace}:${skill2.name}` : skill2.name;
      const local2 = localSkills.find((s) => s.name.fullName === fullName2);

      if (!local2) continue;

      // Check name similarity and description similarity
      const nameSim = similarity(skill1.name, skill2.name);
      const descSim = similarity(local1.frontmatter.description, local2.frontmatter.description);

      if (nameSim > 0.5 || descSim > 0.6) {
        similar.push(fullName2);
        processed.add(skill2.name);
      }
    }

    if (similar.length > 1) {
      candidates.push(similar);
    }

    processed.add(skill1.name);
  }

  return candidates;
}

export async function runCurator(options: CuratorOptions = {}): Promise<CuratorSuggestion[]> {
  const {
    dryRun = false,
    staleAfterDays = 30,
    minUseCount = 2,
  } = options;

  const usageEntries = loadUsage();
  const agentSkills = usageEntries.filter((e) => e.createdBy === "agent");
  const localSkills = await listLocalSkills();

  const suggestions: CuratorSuggestion[] = [];

  // Find stale or low-use skills to archive
  for (const skill of agentSkills) {
    if (skill.state === "archived") continue;

    if (skill.useCount <= minUseCount || isStale(skill, staleAfterDays)) {
      suggestions.push({
        action: "archive",
        skills: [skill.namespace ? `${skill.namespace}:${skill.name}` : skill.name],
        reason: `Use count: ${skill.useCount}, state: ${skill.state}, last used: ${skill.lastUsedAt}`,
      });
    }
  }

  // Find similar skills to merge
  const mergeCandidates = await findMergeCandidates(agentSkills, localSkills);
  for (const group of mergeCandidates) {
    suggestions.push({
      action: "merge",
      skills: group,
      reason: "Similar naming and/or description detected",
    });
  }

  // Find active skills that could evolve
  const activeSkills = agentSkills.filter(
    (s) => s.state === "active" && s.useCount > minUseCount && !isStale(s, staleAfterDays),
  );

  for (const skill of activeSkills.slice(0, 3)) {
    // Limit to 3 suggestions per run
    suggestions.push({
      action: "evolve",
      skills: [skill.namespace ? `${skill.namespace}:${skill.name}` : skill.name],
      reason: "Active skill with usage patterns to analyze",
    });
  }

  // Apply actions if not dry run
  if (!dryRun) {
    for (const suggestion of suggestions) {
      await applyCuratorAction(suggestion);
    }
  }

  return suggestions;
}

async function applyCuratorAction(action: CuratorSuggestion): Promise<void> {
  const usageEntries = loadUsage();

  if (action.action === "archive") {
    for (const fullName of action.skills) {
      const entry = usageEntries.find((e) => {
        const entryFullName = e.namespace ? `${e.namespace}:${e.name}` : e.name;
        return entryFullName === fullName;
      });

      if (entry) {
        entry.state = "archived";
      }
    }
    saveUsage(usageEntries);
  } else if (action.action === "merge") {
    // Mark all but the first as absorbed
    for (let i = 1; i < action.skills.length; i++) {
      const fullName = action.skills[i]!;
      const entry = usageEntries.find((e) => {
        const entryFullName = e.namespace ? `${e.namespace}:${e.name}` : e.name;
        return entryFullName === fullName;
      });

      if (entry) {
        entry.state = "archived";
        entry.absorbedInto = action.skills[0]!;
      }
    }
    saveUsage(usageEntries);
  }
  // evolve action is handled separately by evolveSkill
}

export async function evolveSkill(skillName: string): Promise<string | null> {
  const SKM_BASE_DIR = path.join(os.homedir(), ".skm", "skills");
  const skillPath = path.join(SKM_BASE_DIR, skillName.replace(":", "/"), "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    throw new Error(`Skill not found: ${skillName}`);
  }

  const content = fs.readFileSync(skillPath, "utf-8");

  const prompt = `Analyze this skill and suggest improvements:\n\n${content}`;

  try {
    const response = await generateWithLlm(CURATOR_PROMPT, prompt);

    let cleaned = response.trim();
    if (cleaned.startsWith("```json")) {
      cleaned = cleaned.slice(7);
    }
    if (cleaned.startsWith("```")) {
      cleaned = cleaned.slice(3);
    }
    if (cleaned.endsWith("```")) {
      cleaned = cleaned.slice(0, -3);
    }
    cleaned = cleaned.trim();

    const parsed = JSON.parse(cleaned) as { improvements: string[]; evolvedContent: string | null };

    if (!parsed.improvements || parsed.improvements.length === 0) {
      return null;
    }

    return parsed.evolvedContent;
  } catch {
    return null;
  }
}
