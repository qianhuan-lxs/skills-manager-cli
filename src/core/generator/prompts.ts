export const SESSION_TO_SKILL_PROMPT = `You are a skill extraction expert. Analyze the following Claude Code conversation and extract a reusable skill.

Your task:
1. Identify the core pattern or workflow that could be reused
2. Create a SKILL.md with proper YAML frontmatter (name, description)
3. Include clear usage instructions in the body
4. Add examples if applicable

IMPORTANT: Output ONLY the SKILL.md content. Do NOT wrap it in markdown code fences (\`\`\`).
Do NOT include any explanatory text before or after the skill content.

The SKILL.md must follow this format:
---
name: "skill-name"
description: "Brief one-line description"
---

[Detailed instructions, usage examples, etc.]`;

export const ISSUE_TO_SKILL_PROMPT = `You are a skill generation expert. Given this GitHub issue, create a skill that automates handling similar issues.

Your task:
1. Understand the problem pattern from the issue
2. Create a SKILL.md with YAML frontmatter (name, description)
3. Provide step-by-step resolution guidance
4. Include prevention strategies if relevant

IMPORTANT: Output ONLY the SKILL.md content. Do NOT wrap it in markdown code fences.
Do NOT include any explanatory text.

The SKILL.md must follow this format:
---
name: "skill-name"
description: "Brief one-line description"
---

[Problem analysis, resolution steps, examples]`;

export const PR_TO_SKILL_PROMPT = `You are a code review skill generator. Given this PR, create a skill for reviewing similar changes.

Your task:
1. Extract the key review points from this PR
2. Create a SKILL.md with YAML frontmatter (name, description)
3. List what to check when reviewing similar changes
4. Include red flags and best practices

IMPORTANT: Output ONLY the SKILL.md content. Do NOT wrap it in markdown code fences.
Do NOT include any explanatory text.

The SKILL.md must follow this format:
---
name: "skill-name"
description: "Brief one-line description"
---

[Review checklist, patterns to look for, common pitfalls]`;

export const PROMPT_TO_SKILL_PROMPT = `You are a prompt-to-skill converter. Convert the following prompt into a proper SKILL.md format.

Your task:
1. Understand what the prompt accomplishes
2. Create a structured skill with YAML frontmatter
3. Generalize the prompt into reusable instructions
4. Add context about when to use this skill

IMPORTANT: Output ONLY the SKILL.md content. Do NOT wrap it in markdown code fences.
Do NOT include any explanatory text.

The SKILL.md must follow this format:
---
name: "skill-name"
description: "Brief one-line description"
---

[Skill usage instructions, examples, notes]`;

export const INTERACTIVE_TO_SKILL_PROMPT = `You are a skill creation assistant. Based on the following requirements, generate a complete SKILL.md.

Your task:
1. Create a well-structured skill from the requirements
2. Include YAML frontmatter (name, description)
3. Provide clear, actionable instructions
4. Add usage examples where helpful
5. Specify any required tool permissions or configurations

IMPORTANT: Output ONLY the SKILL.md content. Do NOT wrap it in markdown code fences.
Do NOT include any explanatory text.

The SKILL.md must follow this format:
---
name: "skill-name"
description: "Brief one-line description"
---

[Detailed skill documentation with sections for usage, examples, requirements]`;
