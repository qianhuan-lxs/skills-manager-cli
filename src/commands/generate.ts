import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { spawn } from "node:child_process";
import { glob } from "glob";
import * as p from "@clack/prompts";
import { generateWithLlm } from "../core/generator/llm-client.js";
import {
  parseLlmOutput,
  injectNamespace,
  saveGeneratedSkill,
  type ParsedSkillOutput,
} from "../core/generator/skill-builder.js";
import {
  SESSION_TO_SKILL_PROMPT,
  ISSUE_TO_SKILL_PROMPT,
  PR_TO_SKILL_PROMPT,
  PROMPT_TO_SKILL_PROMPT,
  INTERACTIVE_TO_SKILL_PROMPT,
} from "../core/generator/prompts.js";

interface GenerateOptions {
  fromSession?: boolean;
  fromIssue?: string;
  fromPr?: string;
  fromPrompt?: string;
  interactive?: boolean;
  namespace?: string;
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

interface GitHubIssue {
  title: string;
  body: string;
  number: number;
  user: { login: string };
  labels: { name: string }[];
}

interface GitHubPullRequest extends GitHubIssue {
  diff?: string;
}

async function fetchFromGitHub(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3+json",
      ...(process.env.GITHUB_TOKEN ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` } : {}),
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("GitHub resource not found. Check the owner/repo and number.");
    }
    if (response.status === 401) {
      throw new Error("GitHub authentication failed. Set GITHUB_TOKEN environment variable.");
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return response.text();
}

async function getLatestConversationLog(): Promise<string> {
  const claudeDir = path.join(os.homedir(), ".claude", "projects");
  const files = await glob("**/*.jsonl", { cwd: claudeDir, absolute: true });

  if (files.length === 0) {
    throw new Error("No Claude Code conversation logs found in ~/.claude/projects/");
  }

  // Sort by modification time, get the most recent
  const sorted = files.toSorted((a, b) => {
    const statA = fs.statSync(a);
    const statB = fs.statSync(b);
    return statB.mtimeMs - statA.mtimeMs;
  });

  const latestFile = sorted[0]!;
  const content = fs.readFileSync(latestFile, "utf-8");
  const lines = content.trim().split("\n");

  // Get last 50 lines to stay within context limits
  const recentLines = lines.slice(-50);
  const messages = recentLines
    .map((line) => {
      try {
        const msg = JSON.parse(line);
        if (msg.role === "user" || msg.role === "assistant") {
          return `${msg.role}: ${msg.content?.slice(0, 500) ?? ""}`;
        }
      } catch {
        // Skip invalid lines
      }
      return null;
    })
    .filter(Boolean);

  return messages.join("\n\n");
}

async function fetchIssue(ref: string): Promise<GitHubIssue> {
  const match = ref.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) {
    throw new Error(`Invalid issue reference "${ref}". Expected format: owner/repo#123`);
  }

  const [, owner, repo, number] = match;
  const url = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
  const data = await fetchFromGitHub(url);
  return JSON.parse(data) as GitHubIssue;
}

async function fetchPullRequest(ref: string): Promise<GitHubPullRequest> {
  const match = ref.match(/^([^/]+)\/([^#]+)#(\d+)$/);
  if (!match) {
    throw new Error(`Invalid PR reference "${ref}". Expected format: owner/repo#456`);
  }

  const [, owner, repo, number] = match;
  const issueUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;
  const prUrl = `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`;

  const [issueData, prData] = await Promise.all([
    fetchFromGitHub(issueUrl).then((d) => JSON.parse(d) as GitHubIssue),
    fetchFromGitHub(prUrl).then((d) => JSON.parse(d) as { diff_url: string }),
  ]);

  // Fetch the diff
  const diff = await fetchFromGitHub(prData.diff_url);

  return {
    ...issueData,
    diff,
  };
}

function formatIssue(issue: GitHubIssue): string {
  return `# ${issue.title}

Issue #${issue.number} by @${issue.user.login}
Labels: ${issue.labels.map((l) => l.name).join(", ") || "none"}

${issue.body}`;
}

function formatPullRequest(pr: GitHubPullRequest): string {
  return `# ${pr.title}

PR #${pr.number} by @${pr.user.login}
Labels: ${pr.labels.map((l) => l.name).join(", ") || "none"}

## Description
${pr.body}

## Diff
\`\`\`diff
${pr.diff?.slice(0, 10000)}\`\`\``;
}

async function interactiveMode(): Promise<string> {
  const answers = (await p.group(
    {
      purpose: () =>
        p.text({
          message: "What is the purpose of this skill?",
          placeholder: "e.g., Debug failing TypeScript tests",
        }),
      scenarios: () =>
        p.text({
          message: "What scenarios should it handle?",
          placeholder: "e.g., Test failures, type errors, compilation errors",
        }),
      steps: () =>
        p.text({
          message: "What are the key steps?",
          placeholder: "e.g., 1. Read test output 2. Identify error location 3. Suggest fix",
        }),
      permissions: () =>
        p.text({
          message: "What tool permissions does it need? (optional)",
          placeholder: "e.g., Read files, run tests",
        }),
      outputFormat: () =>
        p.select({
          message: "What output format?",
          options: [
            { value: "text", label: "Plain text" },
            { value: "json", label: "JSON" },
            { value: "markdown", label: "Markdown" },
          ],
          initialValue: "text" as string,
        }),
    },
    {
      onCancel: () => {
        p.cancel("Operation cancelled");
        process.exit(0);
      },
    },
  )) as {
    purpose: string;
    scenarios: string;
    steps: string;
    permissions?: string;
    outputFormat: string;
  };

  return `Skill Purpose: ${answers.purpose}

Scenarios to Handle: ${answers.scenarios}

Key Steps: ${answers.steps}
${answers.permissions ? `Required Permissions: ${answers.permissions}` : ""}

Expected Output Format: ${answers.outputFormat}`;
}

async function showPreviewAndConfirm(
  parsed: ParsedSkillOutput,
  namespace: string,
): Promise<"install" | "edit" | "regenerate" | "cancel"> {
  const skillName = injectNamespace(parsed.frontmatter.name, namespace);

  p.note(
    `${parsed.frontmatter.name}\n${parsed.frontmatter.description}\n\n${parsed.body.slice(0, 500)}${parsed.body.length > 500 ? "..." : ""}`,
    `Generated Skill: ${skillName}`,
  );

  const action = await p.select({
    message: "What would you like to do?",
    options: [
      { value: "install", label: "Install this skill" },
      { value: "edit", label: "Edit before installing" },
      { value: "regenerate", label: "Regenerate (try again)" },
      { value: "cancel", label: "Cancel" },
    ],
    initialValue: "install" as const,
  });

  return action as "install" | "edit" | "regenerate" | "cancel";
}

async function editSkill(parsed: ParsedSkillOutput): Promise<ParsedSkillOutput> {
  const editor = process.env.EDITOR || "vim";
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "skm-edit-"));
  const tempFile = path.join(tempDir, "SKILL.md");

  const content = `---
name: "${parsed.frontmatter.name}"
description: "${parsed.frontmatter.description}"
---

${parsed.body}`;

  fs.writeFileSync(tempFile, content, "utf-8");

  await new Promise<void>((resolve, reject) => {
    const proc = spawn(editor, [tempFile], { stdio: "inherit" });
    proc.on("exit", (code: number) => {
      if (code === 0) resolve();
      else reject(new Error(`Editor exited with code ${code}`));
    });
  });

  const edited = fs.readFileSync(tempFile, "utf-8");
  fs.rmSync(tempDir, { recursive: true, force: true });

  return parseLlmOutput(edited);
}

export async function handleGenerateAction(
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _args: string[],
  options: GenerateOptions,
): Promise<void> {
  const modeFlags = [
    options.fromSession,
    options.fromIssue,
    options.fromPr,
    options.fromPrompt,
    options.interactive,
  ].filter(Boolean);

  if (modeFlags.length !== 1) {
    console.error("Error: Exactly one generation mode must be specified.");
    console.error("Modes: --from-session, --from-issue, --from-pr, --from-prompt, --interactive");
    process.exit(1);
  }

  const namespace = options.namespace ?? "skm";
  let systemPrompt: string;
  let userPrompt: string;

  if (options.fromSession) {
    systemPrompt = SESSION_TO_SKILL_PROMPT;
    p.intro("Extracting skill from latest Claude Code session...");
    const conversation = await getLatestConversationLog();
    userPrompt = `Extract a reusable skill from this conversation:\n\n${conversation}`;
  } else if (options.fromIssue) {
    systemPrompt = ISSUE_TO_SKILL_PROMPT;
    p.intro(`Fetching issue ${options.fromIssue}...`);
    const issue = await fetchIssue(options.fromIssue);
    userPrompt = `Create a skill based on this issue:\n\n${formatIssue(issue)}`;
  } else if (options.fromPr) {
    systemPrompt = PR_TO_SKILL_PROMPT;
    p.intro(`Fetching PR ${options.fromPr}...`);
    const pr = await fetchPullRequest(options.fromPr);
    userPrompt = `Create a skill based on this PR:\n\n${formatPullRequest(pr)}`;
  } else if (options.fromPrompt) {
    systemPrompt = PROMPT_TO_SKILL_PROMPT;
    p.intro(`Reading prompt from ${options.fromPrompt}...`);
    const promptContent = fs.readFileSync(options.fromPrompt, "utf-8");
    userPrompt = `Convert this prompt into a skill:\n\n${promptContent}`;
  } else if (options.interactive) {
    systemPrompt = INTERACTIVE_TO_SKILL_PROMPT;
    p.intro("Interactive skill creation");
    userPrompt = await interactiveMode();
  } else {
    throw new Error("No generation mode specified");
  }

  // Generation loop (for regeneration)
  let parsed = parseLlmOutput(
    await generateWithLlm(systemPrompt, userPrompt, {
      baseUrl: options.baseUrl,
      apiKey: options.apiKey,
      model: options.model,
    }),
  );

  while (true) {
    const action = await showPreviewAndConfirm(parsed, namespace);

    if (action === "install") {
      const savedPath = await saveGeneratedSkill(parsed, namespace);
      p.note(savedPath, "Skill installed successfully");
      p.outro("Done!");
      break;
    } else if (action === "edit") {
      parsed = await editSkill(parsed);
      // Loop back to show preview
    } else if (action === "regenerate") {
      const spin = p.spinner();
      spin.start("Regenerating...");
      parsed = parseLlmOutput(
        await generateWithLlm(systemPrompt, userPrompt, {
          baseUrl: options.baseUrl,
          apiKey: options.apiKey,
          model: options.model,
        }),
      );
      spin.stop("Regenerated");
      // Loop back to show preview
    } else {
      p.cancel("Cancelled");
      process.exit(0);
    }
  }
}
