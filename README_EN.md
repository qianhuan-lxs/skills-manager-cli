<div align="center">

# `skm` — AI Skill Lifecycle Manager

**Full-lifecycle management CLI for AI coding agent skills**

English | [简体中文](./README.md)

---

```
╔══════════════════════════════════════════════════════════╗
║  skm search   →  discover skills from community         ║
║  skm scan     →  9-category security analysis            ║
║  skm generate →  LLM-powered skill creation              ║
║  skm evolve   →  self-evolving Curator engine            ║
╚══════════════════════════════════════════════════════════╝
```

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/Vitest-84%20tests-729B1B?logo=vitest&logoColor=white)](https://vitest.dev/)
[![MCP](https://img.shields.io/badge/MCP-Server-orange?logo=modelcontextprotocol)](https://modelcontextprotocol.io/)

</div>

---

## What is this?

`skm` is a **full-lifecycle skill management CLI** designed for AI coding agents (Claude Code, Cursor, Codex, etc.).

It solves the core pain points in today's skill ecosystem:

| Pain Point | skm Solution |
|------------|-------------|
| Hard to discover useful skills | `skm search` — search local, registry, and GitHub simultaneously |
| ~3% of public skills have security risks | `skm scan` — 9-category threat detection with risk scoring |
| Writing skills manually is tedious | `skm generate` — LLM-powered generation from 5 source modes |
| Skills pile up with no cleanup | `skm evolve` — Curator engine auto-archives low-usage skills |

## ⚡ Quick Start

```bash
# Clone & Build
git clone https://github.com/your-org/skills-manager-cli.git
cd skills-manager-cli
pnpm install && pnpm build

# Interactive setup
skm init

# Auto-install Claude Code hooks
skm hooks --install
```

## 🎯 Core Features

### 1. Discovery & Search

```bash
skm search "code review"              # Search community registry
skm search "testing" --source github  # Search GitHub repos
skm search --local                    # List installed skills
skm search --interactive              # Interactive fzf-style search
skm search --namespace skm            # Filter by namespace
skm search --list-namespaces          # List all namespaces
```

### 2. Security Scan（9 Threat Categories）

```bash
skm scan                    # Scan all SKILL.md in current directory
skm scan ./my-skills/       # Scan specific path
skm scan --severity error   # Show only critical issues
skm scan --json             # JSON output for CI/CD
```

| Rule | Detects |
|------|---------|
| command-injection | `rm -rf /`, `curl \| bash`, `$()`, `eval()` |
| path-traversal | `../` traversal, sensitive directory writes |
| credential-exposure | API keys (`sk-`, `AKIA`), tokens, passwords |
| prompt-injection | "ignore previous instructions", role switching |
| mcp-permission-overreach | Excessive permissions, wildcard access |
| filesystem-overreach | Writes to `/etc`, `~/.ssh`, `~/.gnupg` |
| network-exfiltration | DNS exfiltration, external POSTs, webhooks |
| supply-chain | `npx -y`, unpinned deps, untrusted sources |
| format-compliance | Missing frontmatter, invalid field types |

Risk score: **100 - (error×15 + warn×5 + info×1)**. ≥80 safe, ≥50 warning, <50 danger.

### 3. Health Diagnostics

```bash
skm doctor
```

Detects: duplicate installations (cross-project/global), outdated versions, orphaned skills, name conflicts, format compliance.

### 4. Skill CRUD

```bash
skm create my-skill --description "My awesome skill"
skm create ns:my-skill --namespace my-team --description "Team skill"

skm patch my-skill --old "old text" --new "new text"
skm patch my-skill --old "foo" --new "bar" --replace-all

skm delete my-skill
skm delete my-skill --absorbed-into better-skill --force
```

### 5. LLM Auto-Generation

```bash
skm generate --from-session                        # Extract from conversation logs
skm generate --from-issue owner/repo#123           # From GitHub Issue
skm generate --from-pr owner/repo#456              # From GitHub PR
skm generate --from-prompt ./my-prompt.txt         # Convert prompt file
skm generate --interactive                         # Guided Q&A creation
skm generate --interactive --namespace my-team     # Custom namespace
```

All auto-generated skills get the `skm:` namespace prefix by default, preventing conflicts with user-created skills.

### 6. Self-Evolution Engine

Referenced from [Hermes Agent](https://github.com/NousResearch/Hermes-Agent)'s three-layer automatic trigger architecture:

```
┌─────────────────────────────────────────────────┐
│  Layer 1: PostToolUse Hook                      │
│  Auto-runs skm tick after every tool call        │
│  → Increments iteration counter                 │
├─────────────────────────────────────────────────┤
│  Layer 2: Stop Hook                             │
│  Auto-runs skm review --auto-apply on exit       │
│  → LLM analyzes session, extracts reusable      │
│    patterns, auto-generates skills               │
├─────────────────────────────────────────────────┤
│  Layer 3: Curator                               │
│  Manual or scheduled skm evolve                  │
│  → Archive low-use skills, merge similar ones,  │
│    LLM-improved content                          │
└─────────────────────────────────────────────────┘
```

```bash
skm hooks --install                    # One-command hook setup
skm review                             # Analyze session manually
skm review --session path/to/file.jsonl
skm review --auto-apply                # Auto-create suggested skills

skm evolve                             # Full evolution cycle
skm evolve --dry-run                   # Preview suggestions only
skm evolve --skill skm:my-skill        # Evolve single skill
```

### 7. MCP Server

```bash
skm serve                              # stdio mode (Claude Code)
skm serve --transport http --port 3000 # HTTP mode
skm serve --register                   # Auto-register in ~/.mcp.json
```

- **Tools**: `list_skills`, `get_skill_info`, `search_skills`, `scan_skill`, `health_check`
- **Resources**: `skill://list`, `skill://local/{ns}/{name}`
- **Prompts**: `skill-review`, `skill-create`
- **Security**: Zod input validation, audit logging, path traversal protection, 25K-char output truncation

## 🏗️ Architecture

```
src/
├── cli/                    # CLI framework
│   ├── index.ts            # Entry point (lazy loading)
│   ├── lazy-action.ts      # Deferred import mechanism
│   ├── messages.ts         # Unified messaging
│   ├── output.ts           # Output formatting
│   └── config.ts           # Configuration management
├── commands/               # 15 command modules
│   ├── search.ts           # Multi-source search
│   ├── scan.ts             # Security scan
│   ├── doctor.ts           # Health diagnostics
│   ├── generate.ts         # LLM auto-generation
│   ├── create/patch/delete # CRUD operations
│   ├── review.ts           # Session review
│   ├── evolve.ts           # Curator evolution
│   ├── tick.ts             # Iteration counter
│   ├── hooks.ts            # Hooks management
│   └── serve.ts            # MCP Server
├── core/
│   ├── discovery/          # Discovery (local/registry/GitHub)
│   ├── scanner/            # Security scanner (9 rules)
│   ├── health/             # Health diagnostics
│   ├── generator/          # Auto-generation (LLM client + prompts)
│   ├── evolution/          # Self-evolution (counter + reviewer + curator)
│   ├── usage.ts            # Usage tracking
│   ├── audit.ts            # Audit logging + path safety
│   ├── namespace.ts        # Namespace system
│   └── skill-parser.ts     # SKILL.md parse/serialize
└── mcp/
    └── server.ts           # MCP Server (Zod + audit + annotations)
```

## 🔧 Configuration

Config stored at `~/.skm/config.json`, 4-layer priority:

```
CLI args > Environment variables > Config file > Defaults
```

```bash
# Environment variables
export SKM_BASE_URL=https://api.openai.com/v1
export SKM_API_KEY=sk-xxx
export SKM_MODEL=gpt-4o

# CLI config
skm config set llm.baseUrl https://api.openai.com/v1
skm config set llm.apiKey sk-xxx
skm config set llm.model gpt-4o
skm config get llm.baseUrl
skm config list
```

Compatible with any OpenAI-protocol backend (OpenAI, Ollama, vLLM, DeepSeek, GLM, etc.).

## 🧪 Testing

```bash
pnpm test        # 84 tests across 6 files
pnpm test:watch  # Watch mode
```

## 📊 Project Stats

| Metric | Value |
|--------|-------|
| Source Files | 53 TypeScript |
| CLI Commands | 15 (0 stubs) |
| Security Rules | 9 (real regex patterns) |
| MCP Tools | 5 (Zod validated + annotated) |
| Tests | 84 tests, 6 suites |
| Startup | All commands lazy-loaded |

## 🙏 References

This project draws inspiration and design patterns from the following excellent open-source projects:

- **[open-agent-skills/skills](https://github.com/open-agent-skills/skills)** — Skill package manager (`npx skills`). skm's skill discovery and registry interaction references its API design.
- **[NousResearch/Hermes-Agent](https://github.com/NousResearch/Hermes-Agent)** — Self-improving agent TUI. skm's self-evolution engine (three-layer trigger, Curator, iteration counter) is modeled after its `SKILLS_GUIDANCE` + `_iters_since_skill` + `_spawn_background_review` design.
- **[cc-haha/Claude-Code-Desktop](https://github.com/cc-haha/Claude-Code-Desktop)** — Desktop Claude Code IDE. Its `/skillify` interactive interview → auto-generate skill workflow inspired skm generate.
- **[GitNexus](https://github.com/gitnexus-ai/gitnexus)** — Git workflow enhancement. skm's `createLazyAction` deferred loading pattern, MCP Server framework, and `cli-message` unified output system reference its implementation.

## License

[MIT](LICENSE)
