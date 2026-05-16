import { select } from "@clack/prompts";
import { reviewSession, resetCounter, type SkillSuggestion } from "../core/evolution/index.js";
import { generateWithLlm } from "../core/generator/llm-client.js";
import { parseLlmOutput, saveGeneratedSkill } from "../core/generator/skill-builder.js";
import { loadConfig } from "../cli/config.js";
import { cliInfo, cliSuccess, cliError, cliWarn } from "../cli/messages.js";

interface ReviewOptions {
  session?: string;
  autoApply?: boolean;
}

const SKILL_GENERATION_PROMPT = `You are a skill generator. Given a description and reason for a skill, generate the complete SKILL.md content.

The output must follow this exact format:
---
name: "skill-name"
description: "One sentence description"
---

## When to use this skill

[Describe when to trigger this skill]

## What this skill does

[Detailed description of the skill's behavior and purpose]

## How to use

[Instructions for how this skill should be invoked]

## Examples

[Provide concrete examples if applicable]

Generate only the SKILL.md content, wrapped in markdown code fences.`;

async function generateSkillContent(suggestion: SkillSuggestion): Promise<{ name: string; description: string; body: string }> {
  const prompt = `Generate a skill based on this suggestion:

Name: ${suggestion.name}
Description: ${suggestion.description}
Reason: ${suggestion.reason}
Priority: ${suggestion.priority}

Create a complete SKILL.md file that captures this pattern effectively.`;

  const response = await generateWithLlm(SKILL_GENERATION_PROMPT, prompt);
  const parsed = parseLlmOutput(response);

  return {
    name: parsed.frontmatter.name,
    description: parsed.frontmatter.description,
    body: parsed.body,
  };
}

async function processSuggestion(suggestion: SkillSuggestion, namespace: string): Promise<boolean> {
  cliInfo(`\nSkill: ${suggestion.name}`);
  cliInfo(`Description: ${suggestion.description}`);
  cliInfo(`Reason: ${suggestion.reason}`);
  cliInfo(`Priority: ${suggestion.priority}`);

  try {
    const skillContent = await generateSkillContent(suggestion);
    const parsed = {
      frontmatter: {
        name: skillContent.name,
        description: skillContent.description,
      },
      body: skillContent.body,
    };

    const savedPath = await saveGeneratedSkill(parsed, namespace);
    cliSuccess(`Created skill: ${savedPath}`);
    return true;
  } catch (error) {
    cliError(`Failed to generate skill "${suggestion.name}": ${error instanceof Error ? error.message : String(error)}`);
    return false;
  }
}

async function interactiveReview(suggestions: SkillSuggestion[], namespace: string): Promise<void> {
  for (const suggestion of suggestions) {
    const choice = await select({
      message: `Skill: ${suggestion.name} (${suggestion.priority} priority)`,
      options: [
        { value: "create", label: "Create this skill" },
        { value: "skip", label: "Skip" },
      ],
    });

    if (choice === "create") {
      await processSuggestion(suggestion, namespace);
    } else {
      cliWarn(`Skipped: ${suggestion.name}`);
    }
  }
}

export async function handleReviewAction(options: ReviewOptions = {}): Promise<void> {
  const config = loadConfig();
  const namespace = config.evolution?.namespaces ?? "skm";

  try {
    const suggestions = await reviewSession(options.session);

    if (suggestions.length === 0) {
      cliInfo("No skill suggestions found in this session.");
      return;
    }

    cliInfo(`Found ${suggestions.length} skill suggestion(s).`);

    if (options.autoApply) {
      let created = 0;
      for (const suggestion of suggestions) {
        if (await processSuggestion(suggestion, namespace)) {
          created++;
        }
      }
      cliSuccess(`Created ${created}/${suggestions.length} skills.`);
    } else {
      await interactiveReview(suggestions, namespace);
    }

    // Reset counter after review
    resetCounter();
    cliInfo("Iteration counter reset.");
  } catch (error) {
    cliError(`Review failed: ${error instanceof Error ? error.message : String(error)}`);
    throw error;
  }
}
