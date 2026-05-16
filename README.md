<div align="center">

# `skm` — AI Skill Lifecycle Manager

**AI 编码代理 Skill 全生命周期管理 CLI**

[English](./README_EN.md) | 简体中文

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

## 这是什么？

`skm` 是一款专为 AI 编码代理（Claude Code、Cursor、Codex 等）设计的 **Skill 全生命周期管理工具**。

它解决了当前 Skill 生态中的核心痛点：

| 痛点 | skm 的解决方案 |
|------|---------------|
| 不知道有哪些 Skill 可以用 | `skm search` — 同时搜索本地、registry、GitHub |
| 不敢随便装别人的 Skill（~3% 有安全风险） | `skm scan` — 9 类安全威胁检测 + 风险评分 |
| 手写 Skill 太麻烦 | `skm generate` — LLM 自动生成，5 种来源模式 |
| Skill 越积越多，不知道哪些该清理 | `skm evolve` — Curator 自进化引擎，自动归档低频 Skill |

## ⚡ 快速开始

```bash
# 克隆 & 构建
git clone https://github.com/your-org/skills-manager-cli.git
cd skills-manager-cli
pnpm install && pnpm build

# 初始化配置（交互式引导）
skm init

# 安装 Claude Code hooks（PostToolUse + Stop 自动触发）
skm hooks --install
```

## 🎯 核心功能

### 1. Skill 发现与搜索

```bash
skm search "code review"              # 搜索社区 registry
skm search "testing" --source github  # 搜索 GitHub 仓库
skm search --local                    # 查看已安装的本地 Skill
skm search --interactive              # 交互式搜索（fzf 风格）
skm search --namespace skm            # 按命名空间筛选
skm search --list-namespaces          # 列出所有命名空间
```

### 2. 安全扫描（9 类威胁检测）

```bash
skm scan                    # 扫描当前目录下所有 SKILL.md
skm scan ./my-skills/       # 扫描指定路径
skm scan --severity error   # 仅显示高危问题
skm scan --json             # JSON 输出（适合 CI/CD）
```

| 规则 | 检测内容 |
|------|---------|
| `command-injection` | `rm -rf /`、`curl \| bash`、`$()`、`eval()` |
| `path-traversal` | `../` 路径穿越、敏感目录写入 |
| `credential-exposure` | API Key (`sk-`、`AKIA`)、Token、密码明文 |
| `prompt-injection` | "ignore previous instructions"、角色切换、system prompt 覆盖 |
| `mcp-permission-overreach` | 过度权限请求、通配符访问 |
| `filesystem-overreach` | 写入 `/etc`、`~/.ssh`、`~/.gnupg` |
| `network-exfiltration` | DNS 外泄、外部 POST、Webhook 数据上传 |
| `supply-chain` | `npx -y`、未锁定依赖、不受信源安装 |
| `format-compliance` | frontmatter 缺失、字段类型错误 |

风险评分：**100 - (error×15 + warn×5 + info×1)**，≥80 安全，≥50 警告，<50 危险。

### 3. 健康诊断

```bash
skm doctor
```

检测内容：重复安装（跨项目/全局）、版本过期、孤儿 Skill、同名冲突、格式合规。

### 4. Skill CRUD

```bash
skm create my-skill --description "My awesome skill"
skm create ns:my-skill --namespace my-team --description "Team skill"

skm patch my-skill --old "old text" --new "new text"
skm patch my-skill --old "foo" --new "bar" --replace-all

skm delete my-skill
skm delete my-skill --absorbed-into better-skill --force
```

### 5. LLM 自动生成

```bash
skm generate --from-session                        # 从会话日志提取
skm generate --from-issue owner/repo#123           # 从 GitHub Issue 生成
skm generate --from-pr owner/repo#456              # 从 GitHub PR 生成
skm generate --from-prompt ./my-prompt.txt         # 从 Prompt 文件转换
skm generate --interactive                         # 交互式引导生成
skm generate --interactive --namespace my-team     # 指定命名空间
```

所有自动生成的 Skill 默认带 `skm:` 命名空间前缀，防止与用户手动创建的冲突。

### 6. 自进化引擎

参考 [Hermes Agent](https://github.com/NousResearch/Hermes-Agent) 的三层自动触发架构：

```
┌─────────────────────────────────────────────────┐
│  Layer 1: PostToolUse Hook                      │
│  每次工具调用后自动执行 skm tick                  │
│  → 递增迭代计数器                                │
├─────────────────────────────────────────────────┤
│  Layer 2: Stop Hook                             │
│  会话结束时自动执行 skm review --auto-apply       │
│  → LLM 分析对话，提取可复用模式，自动生成 Skill   │
├─────────────────────────────────────────────────┤
│  Layer 3: Curator                               │
│  手动或定时执行 skm evolve                       │
│  → 归档低频 Skill、合并相似 Skill、LLM 改进内容  │
└─────────────────────────────────────────────────┘
```

```bash
skm hooks --install                    # 一键安装自动触发 hooks
skm review                             # 会话审查（手动）
skm review --session path/to/file.jsonl
skm review --auto-apply                # 自动创建建议的 Skill

skm evolve                             # 完整进化周期
skm evolve --dry-run                   # 仅查看建议
skm evolve --skill skm:my-skill        # 进化单个 Skill
```

### 7. MCP Server

```bash
skm serve                              # stdio 模式（Claude Code）
skm serve --transport http --port 3000 # HTTP 模式
skm serve --register                   # 自动注册到 ~/.mcp.json
```

- **Tools**: `list_skills`、`get_skill_info`、`search_skills`、`scan_skill`、`health_check`
- **Resources**: `skill://list`、`skill://local/{ns}/{name}`
- **Prompts**: `skill-review`、`skill-create`
- **安全**: Zod 输入校验、审计日志、路径穿越防护、25K 字符输出截断

## 🏗️ 架构

```
src/
├── cli/                    # CLI 框架
│   ├── index.ts            # 入口（lazy loading）
│   ├── lazy-action.ts      # 延迟加载机制
│   ├── messages.ts         # 统一消息系统
│   ├── output.ts           # 输出格式化
│   └── config.ts           # 配置管理
├── commands/               # 15 个命令模块
│   ├── search.ts           # 多源搜索
│   ├── scan.ts             # 安全扫描
│   ├── doctor.ts           # 健康诊断
│   ├── generate.ts         # LLM 自动生成
│   ├── create/patch/delete # CRUD 操作
│   ├── review.ts           # 会话审查
│   ├── evolve.ts           # Curator 进化
│   ├── tick.ts             # 迭代计数
│   ├── hooks.ts            # Hooks 管理
│   └── serve.ts            # MCP Server
├── core/
│   ├── discovery/          # 发现模块（本地/registry/GitHub）
│   ├── scanner/            # 安全扫描引擎（9 规则）
│   ├── health/             # 健康诊断
│   ├── generator/          # 自动生成（LLM 客户端 + Prompt 模板）
│   ├── evolution/          # 自进化（计数器 + 审查 + Curator）
│   ├── usage.ts            # 使用追踪
│   ├── audit.ts            # 审计日志 + 路径防护
│   ├── namespace.ts        # 命名空间系统
│   └── skill-parser.ts     # SKILL.md 解析/序列化
└── mcp/
    └── server.ts           # MCP Server（Zod 校验 + 审计 + 注解）
```

## 🔧 配置

配置存储在 `~/.skm/config.json`，支持 4 层优先级：

```
CLI 参数 > 环境变量 > 配置文件 > 默认值
```

```bash
# 环境变量
export SKM_BASE_URL=https://api.openai.com/v1
export SKM_API_KEY=sk-xxx
export SKM_MODEL=gpt-4o

# CLI 配置
skm config set llm.baseUrl https://api.openai.com/v1
skm config set llm.apiKey sk-xxx
skm config set llm.model gpt-4o
skm config get llm.baseUrl
skm config list
```

兼容任何 OpenAI 协议的 LLM 后端（OpenAI、Ollama、vLLM、DeepSeek、GLM 等）。

## 🧪 测试

```bash
pnpm test          # 运行 84 个测试
pnpm test:watch    # 监听模式
```

## 📊 项目数据

| 指标 | 数值 |
|------|------|
| 源文件 | 53 TypeScript |
| CLI 命令 | 15（0 stub） |
| 安全规则 | 9（真实 regex 模式） |
| MCP Tools | 5（Zod 校验 + 审计 + 注解） |
| 测试 | 84 tests, 6 suites |
| 启动优化 | 全部命令 lazy loading |

## 🙏 参考 / References

本项目从以下优秀的开源项目中汲取了灵感和设计模式：

- **[open-agent-skills/skills](https://github.com/open-agent-skills/skills)** — Skill 包管理器，`npx skills` 的实现。skm 的 Skill 发现与 registry 交互参考了它的 API 设计。
- **[NousResearch/Hermes-Agent](https://github.com/NousResearch/Hermes-Agent)** — 自我改进循环的 Agent TUI。skm 的自进化引擎（三层触发、Curator、迭代计数）照搬了其 `SKILLS_GUIDANCE` + `_iters_since_skill` + `_spawn_background_review` 设计。
- **[cc-haha/Claude-Code-Desktop](https://github.com/cc-haha/Claude-Code-Desktop)** — 桌面端 Claude Code IDE。其 `/skillify` 命令的交互式访谈→自动生成 Skill 流程启发了 skm generate 的设计。
- **[GitNexus](https://github.com/gitnexus-ai/gitnexus)** — Git 工作流增强工具。skm 的 `createLazyAction` 延迟加载模式、MCP Server 框架和 `cli-message` 统一输出系统参考了其实现。

## License

[MIT](LICENSE)
