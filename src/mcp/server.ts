/**
 * MCP Server for Skills Manager CLI
 *
 * Model Context Protocol server that provides skill management tools.
 * Supports stdio and HTTP transports for integration with Claude Code and other MCP clients.
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { promises as fs } from "node:fs";
import { z } from "zod/v4";
import { listLocalSkills, getLocalSkill, listNamespaces } from "../core/discovery/local.js";
import { searchRegistry, getRegistrySkill } from "../core/discovery/registry.js";
import { ScanEngine } from "../core/scanner/engine.js";
import { runDoctor } from "../core/health/index.js";
import { parseSkillMd } from "../core/skill-parser.js";
import { parseNamespacedName } from "../core/namespace.js";
import { logAudit, validatePathSafety } from "../core/audit.js";
import { truncateOutput } from "../cli/output.js";

const listSkillsSchema = z.object({ namespace: z.string().optional(), source: z.enum(["project", "global", "all"]).optional() });
const getSkillInfoSchema = z.object({ name: z.string() });
const searchSkillsSchema = z.object({ query: z.string(), limit: z.number().optional() });
const scanSkillSchema = z.object({ name: z.string().optional(), path: z.string().optional() });
const healthCheckSchema = z.object({ path: z.string().optional() });

export interface McpServerOptions {
  transport: "stdio" | "http";
  port?: number;
}

/**
 * MCP tool definitions for skill management.
 */
const SKM_TOOLS = [
  {
    name: "list_skills",
    description: "List all available skills with their metadata",
    inputSchema: {
      type: "object" as const,
      properties: {
        namespace: {
          type: "string" as const,
          description: "Filter skills by namespace (optional)",
        },
        source: {
          type: "string" as const,
          description: "Filter skills by source: 'project', 'global', or 'all' (default: 'all')",
          enum: ["project", "global", "all"],
        },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "get_skill_info",
    description: "Get detailed information about a specific skill",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "Skill name (can include namespace prefix like 'ns:skill')",
        },
      },
      required: ["name"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "search_skills",
    description: "Search for skills by keyword or category in the registry",
    inputSchema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string" as const,
          description: "Search query",
        },
        limit: {
          type: "number" as const,
          description: "Maximum number of results (default: 20)",
        },
      },
      required: ["query"],
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "scan_skill",
    description: "Scan a skill for security issues and best practices",
    inputSchema: {
      type: "object" as const,
      properties: {
        name: {
          type: "string" as const,
          description: "Skill name to scan",
        },
        path: {
          type: "string" as const,
          description: "Direct path to skill file (overrides name)",
        },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
  {
    name: "health_check",
    description: "Run health diagnostics on the skills installation",
    inputSchema: {
      type: "object" as const,
      properties: {
        path: {
          type: "string" as const,
          description: "Root path to check (default: current working directory)",
        },
      },
    },
    annotations: { readOnlyHint: true, idempotentHint: true },
  },
];

/**
 * Resource definitions for MCP.
 */
const SKM_RESOURCES = [
  {
    uri: "skill://list",
    name: "All Skills",
    description: "List of all installed skills as JSON",
    mimeType: "application/json",
  },
];

/**
 * Create and configure the MCP Server instance.
 * Returns a Server object that can be connected to any transport.
 */
export function createMcpServer(): Server {
  const server = new Server(
    {
      name: "skills-manager-cli",
      version: "0.1.0",
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: SKM_TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    // Audit logging
    logAudit(name, args ?? {});

    // Zod validation
    let validatedArgs: Record<string, unknown>;
    const schemas: Record<string, z.ZodType> = {
      list_skills: listSkillsSchema,
      get_skill_info: getSkillInfoSchema,
      search_skills: searchSkillsSchema,
      scan_skill: scanSkillSchema,
      health_check: healthCheckSchema,
    };
    const schema = schemas[name];
    if (schema) {
      const result = schema.safeParse(args);
      if (!result.success) {
        return { content: [{ type: "text", text: `Invalid input: ${result.error.message}` }], isError: true };
      }
      validatedArgs = result.data as Record<string, unknown>;
    } else {
      validatedArgs = args as Record<string, unknown>;
    }

    // Path safety validation for scan_skill and health_check
    if (name === "scan_skill" && validatedArgs.path) {
      validatePathSafety(validatedArgs.path as string);
    }
    if (name === "health_check" && validatedArgs.path) {
      validatePathSafety(validatedArgs.path as string);
    }

    try {
      let result: unknown;

      switch (name) {
        case "list_skills":
          result = await handleListSkills(validatedArgs as { namespace?: string; source?: "project" | "global" | "all" });
          break;
        case "get_skill_info":
          result = await handleGetSkillInfo(validatedArgs as { name: string });
          break;
        case "search_skills":
          result = await handleSearchSkills(validatedArgs as { query: string; limit?: number });
          break;
        case "scan_skill":
          result = await handleScanSkill(validatedArgs as { name?: string; path?: string });
          break;
        case "health_check":
          result = await handleHealthCheck(validatedArgs as { path?: string });
          break;
        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      const text = typeof result === "string" ? result : JSON.stringify(result, null, 2);
      return { content: [{ type: "text", text: truncateOutput(text) }] };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        content: [
          {
            type: "text",
            text: `Error: ${message}`,
          },
        ],
        isError: true,
      };
    }
  });

  // Handle list resources request
  server.setRequestHandler(ListResourcesRequestSchema, async () => {
    const staticResources = SKM_RESOURCES;

    // Get all local skills to create dynamic resources
    const skills = await listLocalSkills();
    const skillResources = skills.map((skill) => ({
      uri: `skill://local/${skill.name.namespace ? `${skill.name.namespace}/` : ""}${skill.name.name}`,
      name: skill.name.fullName,
      description: skill.frontmatter.description || "No description",
      mimeType: "text/markdown",
    }));

    return {
      resources: [...staticResources, ...skillResources],
    };
  });

  // Handle read resource request
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    try {
      let content: string;
      let mimeType = "application/json";

      if (uri === "skill://list") {
        const skills = await listLocalSkills();
        content = JSON.stringify(
          {
            skills: skills.map((s) => ({
              name: s.name.fullName,
              namespace: s.name.namespace,
              description: s.frontmatter.description,
              version: s.frontmatter.version,
              source: s.source,
            })),
            total: skills.length,
          },
          null,
          2
        );
      } else if (uri.startsWith("skill://local/")) {
        // Extract skill path from URI: skill://local/{namespace}/{name} or skill://local/{name}
        const skillPath = uri.replace("skill://local/", "");
        const skill = await getLocalSkill(skillPath);
        if (!skill) {
          throw new Error(`Skill not found: ${skillPath}`);
        }
        const fileContent = await fs.readFile(skill.filePath, "utf-8");
        content = fileContent;
        mimeType = "text/markdown";
      } else {
        throw new Error(`Unknown resource: ${uri}`);
      }

      return {
        contents: [
          {
            uri,
            mimeType,
            text: content,
          },
        ],
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      return {
        contents: [
          {
            uri,
            mimeType: "text/plain",
            text: `Error: ${message}`,
          },
        ],
      };
    }
  });

  // Handle list prompts request
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [
      {
        name: "skill-review",
        description: "Review and analyze a skill before integration",
        arguments: [
          {
            name: "skill_name",
            description: "Name of the skill to review",
            required: true,
          },
        ],
      },
      {
        name: "skill-create",
        description: "Create a new skill from a description",
        arguments: [
          {
            name: "description",
            description: "Description of what the skill should do",
            required: true,
          },
          {
            name: "name",
            description: "Name for the skill (optional)",
            required: false,
          },
        ],
      },
    ],
  }));

  // Handle get prompt request
  server.setRequestHandler(GetPromptRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    if (name === "skill-review") {
      const skillName = args?.skill_name as string | undefined;
      if (!skillName) {
        throw new Error("skill_name is required for skill-review prompt");
      }

      // Try to get the skill info
      const skill = await getLocalSkill(skillName);
      let skillInfo = "";
      if (skill) {
        skillInfo = `\n\nSkill Info:\n- Description: ${skill.frontmatter.description}\n- Version: ${skill.frontmatter.version || "N/A"}\n- Source: ${skill.source}\n- File: ${skill.filePath}`;
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Please review the skill "${skillName}" for integration.${skillInfo}

Analyze the following aspects:
1. **Functionality**: What does this skill do and how does it work?
2. **Dependencies**: What external dependencies or APIs does it require?
3. **Security**: Are there any security concerns or vulnerabilities?
4. **Best Practices**: Does it follow skill development best practices?
5. **Integration**: What steps are needed to integrate this skill?

Provide a comprehensive review with recommendations.`,
            },
          },
        ],
      };
    }

    if (name === "skill-create") {
      const description = args?.description as string | undefined;
      const suggestedName = args?.name as string | undefined;

      if (!description) {
        throw new Error("description is required for skill-create prompt");
      }

      let namePrompt = suggestedName
        ? `The suggested name for this skill is "${suggestedName}".`
        : "Please suggest an appropriate name for this skill.";

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `Create a new skill based on the following description:\n\n${description}\n\n${namePrompt}

Please generate:
1. **SKILL.md** with proper frontmatter (name, description)
2. **Implementation code** with the core logic
3. **Usage examples** demonstrating how to use the skill
4. **Tests** to verify the skill works correctly

Follow the skill development best practices:
- Use clear, descriptive names
- Include error handling
- Add comprehensive documentation
- Ensure type safety
- Consider edge cases`,
            },
          },
        ],
      };
    }

    throw new Error(`Unknown prompt: ${name}`);
  });

  return server;
}

/**
 * Tool handlers with real implementations
 */

interface ListSkillsResult {
  skills: Array<{
    name: string;
    namespace: string | null;
    fullName: string;
    description: string;
    version?: string;
    source: "project" | "global";
  }>;
  total: number;
  namespaces: string[];
}

async function handleListSkills(filters: {
  namespace?: string;
  source?: "project" | "global" | "all";
}): Promise<ListSkillsResult> {
  const { namespace, source = "all" } = filters;

  const options: {
    includeProject?: boolean;
    includeGlobal?: boolean;
    namespace?: string;
  } = {
    includeProject: source === "all" || source === "project",
    includeGlobal: source === "all" || source === "global",
  };

  if (namespace) {
    options.namespace = namespace;
  }

  const skills = await listLocalSkills(options);

  return {
    skills: skills.map((s) => ({
      name: s.name.name,
      namespace: s.name.namespace,
      fullName: s.name.fullName,
      description: s.frontmatter.description,
      version: s.frontmatter.version,
      source: s.source,
    })),
    total: skills.length,
    namespaces: listNamespaces(options),
  };
}

interface SkillInfoResult {
  name: string;
  namespace: string | null;
  fullName: string;
  description: string;
  version?: string;
  metadata?: Record<string, unknown>;
  body: string;
  filePath: string;
  source: "project" | "global";
}

async function handleGetSkillInfo(params: { name: string }): Promise<SkillInfoResult> {
  const { name } = params;
  const skill = await getLocalSkill(name);

  if (!skill) {
    // Try registry if not found locally
    const namespaced = parseNamespacedName(name);
    const registrySkill = await getRegistrySkill(namespaced.name);
    if (registrySkill) {
      return {
        name: registrySkill.name,
        namespace: registrySkill.namespace ?? null,
        fullName: name,
        description: registrySkill.description,
        version: registrySkill.version,
        metadata: {
          author: registrySkill.author,
          repository: registrySkill.repository,
          homepage: registrySkill.homepage,
          tags: registrySkill.tags,
          downloads: registrySkill.downloads,
          rating: registrySkill.rating,
        },
        body: "",
        filePath: "",
        source: "project",
      };
    }
    throw new Error(`Skill not found: ${name}`);
  }

  return {
    name: skill.name.name,
    namespace: skill.name.namespace,
    fullName: skill.name.fullName,
    description: skill.frontmatter.description,
    version: skill.frontmatter.version,
    metadata: skill.frontmatter.metadata,
    body: skill.body,
    filePath: skill.filePath,
    source: skill.source,
  };
}

interface SearchSkillsResult {
  skills: Array<{
    name: string;
    namespace?: string;
    description: string;
    version?: string;
    author?: string;
    repository?: string;
    tags?: string[];
    downloads?: number;
    rating?: number;
  }>;
  total: number;
  hasMore: boolean;
}

async function handleSearchSkills(params: { query: string; limit?: number }): Promise<SearchSkillsResult> {
  const { query, limit = 20 } = params;

  const result = await searchRegistry({ query, limit });

  return {
    skills: result.skills.map((s) => ({
      name: s.name,
      namespace: s.namespace,
      description: s.description,
      version: s.version,
      author: s.author,
      repository: s.repository,
      tags: s.tags,
      downloads: s.downloads,
      rating: s.rating,
    })),
    total: result.total,
    hasMore: result.hasMore,
  };
}

interface ScanSkillResult {
  skill: string;
  riskScore: number;
  summary: {
    error: number;
    warn: number;
    info: number;
  };
  findings: Array<{
    ruleId: string;
    severity: "error" | "warn" | "info";
    message: string;
    line?: number;
    snippet?: string;
  }>;
}

async function handleScanSkill(params: { name?: string; path?: string }): Promise<ScanSkillResult> {
  let content: string;
  let frontmatter: Record<string, unknown>;
  let skillName = "";

  if (params.path) {
    // Read directly from path
    content = await fs.readFile(params.path, "utf-8");
    const parsed = parseSkillMd(content, params.path);
    frontmatter = parsed.frontmatter;
    skillName = frontmatter.name as string;
  } else if (params.name) {
    // Find skill by name
    const skill = await getLocalSkill(params.name);
    if (!skill) {
      throw new Error(`Skill not found: ${params.name}`);
    }
    content = await fs.readFile(skill.filePath, "utf-8");
    const parsed = parseSkillMd(content, skill.filePath);
    frontmatter = parsed.frontmatter;
    skillName = params.name;
  } else {
    throw new Error("Either 'name' or 'path' parameter is required");
  }

  const engine = new ScanEngine();
  const result = engine.scan(content, frontmatter);

  return {
    skill: skillName,
    riskScore: result.riskScore,
    summary: result.summary,
    findings: result.findings.map((f) => ({
      ruleId: f.ruleId,
      severity: f.severity,
      message: f.message,
      line: f.line,
      snippet: f.snippet,
    })),
  };
}

interface HealthCheckResult {
  healthy: boolean;
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  issues: Array<{
    type: string;
    severity: "error" | "warn" | "info";
    message: string;
    path?: string;
  }>;
}

async function handleHealthCheck(params: { path?: string }): Promise<HealthCheckResult> {
  const rootPath = params?.path || process.cwd();
  const report = await runDoctor(rootPath);

  return {
    healthy: report.healthy,
    summary: report.summary,
    issues: report.issues.map((issue) => ({
      type: issue.type,
      severity: issue.severity,
      message: issue.message,
      path: issue.path,
    })),
  };
}

/**
 * Start the MCP server with stdio transport.
 */
export async function startStdioServer(): Promise<void> {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);

  // Graceful shutdown
  const shutdown = async (exitCode = 0) => {
    try {
      await server.close();
    } catch {}
    process.exit(exitCode);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
  process.on("exit", shutdown);
}

/**
 * Start the MCP server with HTTP transport.
 */
export async function startHttpServer(port: number): Promise<void> {
  const http = await import("node:http");
  const server = createMcpServer();
  const transport = new StreamableHTTPServerTransport();

  // Create HTTP server
  const httpServer = http.createServer(async (req, res) => {
    try {
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("Error handling HTTP request:", error);
      if (!res.headersSent) {
        res.statusCode = 500;
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ error: "Internal server error" }));
      }
    }
  });

  // Connect the transport to the MCP server
  await server.connect(transport);

  // Start listening
  httpServer.listen(port, () => {
    console.error(`SKM MCP Server listening on HTTP port ${port}`);
  });

  // Graceful shutdown
  const shutdown = async (exitCode = 0) => {
    try {
      await server.close();
      httpServer.close();
    } catch {}
    process.exit(exitCode);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}
