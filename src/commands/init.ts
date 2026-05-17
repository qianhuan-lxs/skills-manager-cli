import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import * as p from "@clack/prompts";
import { saveConfig } from "../cli/config.js";
import { cliSuccess, cliError, cliInfo } from "../cli/messages.js";

const SKM_DIR = path.join(os.homedir(), ".skm");

const GUIDE_SKILL_CONTENT = `---
name: "skm-guide"
description: "Guide for using skm — AI Skill Lifecycle Manager CLI. Teaches the agent when and how to use each skm command."
version: "1.0.0"
---

# skm — AI Skill Lifecycle Manager

You have access to the \`skm\` CLI tool for managing AI coding agent skills. Use it proactively during your work.

## When to Use Each Command

### During Normal Work

| Situation | Command | Why |
|-----------|---------|-----|
| Starting a new project | \`skm search --interactive\` | Discover relevant skills to install |
| About to install a skill | \`skm scan <path>\` | Check for security issues first |
| Something feels off | \`skm doctor\` | Run health diagnostics |
| Finished a complex workflow | Let hooks auto-trigger \`skm review\` | Extract reusable patterns into skills |

### Creating Skills

\`\`\`
# From a conversation (automatic via Stop hook)
skm review --auto-apply

# Manually from different sources
skm generate --from-session      # Extract from current session
skm generate --from-issue owner/repo#123
skm generate --from-pr owner/repo#456
skm generate --from-prompt ./file.txt
skm generate --interactive        # Guided Q&A creation

# Manual CRUD
skm create my-skill --description "What it does"
skm patch my-skill --old "old" --new "new"
skm delete my-skill
\`\`\`

### Skill Maintenance

\`\`\`
skm evolve --dry-run      # Preview what Curator suggests
skm evolve                 # Apply evolution (archive/merge/improve)
skm search --local         # List installed skills
skm info <name>            # View skill details
\`\`\`

## Important Rules

1. **Always scan before installing** — Run \`skm scan\` on any skill from an external source. If risk score < 50, warn the user.
2. **Use namespace prefix** — Auto-generated skills use \`skm:\` prefix. User-created skills can use any namespace.
3. **Let hooks work** — Don't manually call \`skm tick\`. The PostToolUse hook handles iteration counting automatically.
4. **Review on session end** — The Stop hook auto-runs \`skm review --auto-apply\`. If it finds skill-worthy patterns, it creates skills automatically.

## MCP Integration

When the MCP server is registered (\`skm serve --register\`), you can also use these MCP tools directly:
- \`list_skills\` — List installed skills
- \`get_skill_info\` — Get skill details
- \`search_skills\` — Search community registry
- \`scan_skill\` — Security scan a skill
- \`health_check\` — Run diagnostics

## Quick Reference

\`\`\`
skm init                    # First-time setup
skm hooks --install         # Install auto-trigger hooks
skm search <query>          # Search skills
skm scan [path]             # Security scan
skm doctor                  # Health check
skm generate --interactive  # Create skill via Q&A
skm review --auto-apply     # Extract skills from session
skm evolve                  # Curator self-evolution
skm serve --register        # Register MCP server
skm config list             # View configuration
\`\`\`
`;

function installGuideSkill(): void {
  const projectSkillsDir = path.join(process.cwd(), ".claude", "skills", "skm-guide");
  const skillPath = path.join(projectSkillsDir, "SKILL.md");

  if (!fs.existsSync(skillPath)) {
    fs.mkdirSync(projectSkillsDir, { recursive: true });
    fs.writeFileSync(skillPath, GUIDE_SKILL_CONTENT, "utf-8");
  }
}

export async function handleInitAction(): Promise<void> {
  try {
    // Create ~/.skm/ directory
    if (!fs.existsSync(SKM_DIR)) {
      fs.mkdirSync(SKM_DIR, { recursive: true });
    }

    // Check existing config
    const configPath = path.join(SKM_DIR, "config.json");
    const hasExistingConfig = fs.existsSync(configPath);

    if (hasExistingConfig) {
      cliInfo("Existing config found at " + configPath);
      const overwrite = await p.confirm({
        message: "Reconfigure SKM?",
        initialValue: false,
      });
      if (!overwrite) {
        // Still install guide skill even if skipping config
        installGuideSkill();
        cliSuccess("Guide skill installed to .claude/skills/skm-guide/");
        return;
      }
    }

    // Interactive setup
    const answers = (await p.group(
      {
        baseUrl: () =>
          p.text({
            message: "LLM API base URL",
            placeholder: "https://api.openai.com/v1",
            initialValue: "https://api.openai.com/v1",
          }),
        apiKey: () =>
          p.password({
            message: "LLM API key (press Enter to skip)",
          }),
        model: () =>
          p.text({
            message: "Default model",
            placeholder: "gpt-4o",
            initialValue: "gpt-4o",
          }),
        namespace: () =>
          p.text({
            message: "Default namespace for auto-generated skills",
            placeholder: "skm",
            initialValue: "skm",
          }),
      },
      {
        onCancel: () => {
          p.cancel("Operation cancelled");
          process.exit(0);
        },
      },
    )) as {
      baseUrl: string;
      apiKey: string;
      model: string;
      namespace: string;
    };

    // Save config
    const config: Record<string, unknown> = {
      llm: {
        baseUrl: answers.baseUrl || "https://api.openai.com/v1",
        model: answers.model || "gpt-4o",
      },
      evolution: {
        staleAfterDays: 30,
        archiveAfterDays: 90,
        namespaces: answers.namespace || "skm",
        nudgeInterval: 10,
      },
      output: {
        format: "terminal",
      },
    };

    if (answers.apiKey) {
      (config.llm as Record<string, unknown>).apiKey = answers.apiKey;
    }

    saveConfig(config);

    // Install guide skill to current project
    installGuideSkill();

    cliSuccess("SKM initialized successfully!");
    cliInfo(`Config saved to ${configPath}`);
    cliInfo("Guide skill installed to .claude/skills/skm-guide/");
    cliInfo("\nNext steps:");
    cliInfo("  skm hooks --install    # Install Claude Code hooks");
    cliInfo("  skm search --interactive  # Discover skills");
    cliInfo("  skm serve --register    # Register MCP server");
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to initialize SKM");
    }
    process.exit(1);
  }
}
