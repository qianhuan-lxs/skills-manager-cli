/**
 * MCP Server Command
 *
 * `skm serve` - Start the MCP server for skill management.
 * Supports stdio and HTTP transports.
 */

import { Command } from "commander";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { startStdioServer, startHttpServer } from "../mcp/server.js";
import { cliSuccess, cliError, cliInfo } from "../cli/messages.js";

const MCP_CONFIG_PATH = path.join(os.homedir(), ".mcp.json");

interface McpConfig {
  mcpServers?: Record<
    string,
    {
      command: string;
      args?: string[];
      env?: Record<string, string>;
    }
  >;
}

export function registerServeCommand(program: Command): void {
  program
    .command("serve")
    .description("Start MCP server for skill management")
    .option("--transport <type>", "Transport type: stdio or HTTP", "stdio")
    .option("--port <number>", "HTTP port (required for HTTP transport)", "3000")
    .option("--register", "Register server in ~/.mcp.json", false)
    .action(async (options) => {
      const transport = options.transport.toLowerCase();
      const port = parseInt(options.port, 10);

      // Validate transport type
      if (transport !== "stdio" && transport !== "http") {
        cliError('Invalid transport type. Must be "stdio" or "http"');
        process.exit(1);
      }

      // Validate port for HTTP
      if (transport === "http" && (isNaN(port) || port < 1 || port > 65535)) {
        cliError("Invalid port number. Must be between 1 and 65535");
        process.exit(1);
      }

      // Handle registration
      if (options.register) {
        await registerMcpServer(transport, port);
      }

      // Start the server
      cliInfo(`Starting SKM MCP server with ${transport} transport...`);

      try {
        if (transport === "stdio") {
          await startStdioServer();
        } else {
          await startHttpServer(port);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "Unknown error";
        cliError(`Failed to start server: ${message}`);
        process.exit(1);
      }
    });
}

/**
 * Register the SKM MCP server in ~/.mcp.json for automatic discovery.
 */
async function registerMcpServer(transport: string, port: number): Promise<void> {
  try {
    let mcpConfig: McpConfig = {};

    // Load existing config if present
    if (fs.existsSync(MCP_CONFIG_PATH)) {
      const raw = fs.readFileSync(MCP_CONFIG_PATH, "utf-8");
      try {
        mcpConfig = JSON.parse(raw);
      } catch {
        // File exists but is invalid JSON - start fresh
        mcpConfig = {};
      }
    }

    // Initialize mcpServers if needed
    if (!mcpConfig.mcpServers) {
      mcpConfig.mcpServers = {};
    }

    // Get the executable path
    const execPath = process.execPath;
    const scriptPath = path.join(process.cwd(), "dist", "cli", "index.js");

    // Determine args based on transport
    let args: string[];
    if (transport === "stdio") {
      args = [scriptPath, "serve", "--transport", "stdio"];
    } else {
      args = [scriptPath, "serve", "--transport", "http", "--port", String(port)];
    }

    // Register the server
    mcpConfig.mcpServers["skm"] = {
      command: execPath,
      args,
    };

    // Write config
    fs.writeFileSync(MCP_CONFIG_PATH, JSON.stringify(mcpConfig, null, 2), "utf-8");

    cliSuccess(`Registered SKM MCP server in ${MCP_CONFIG_PATH}`);
    cliInfo(`You may need to restart your MCP client to pick up the changes.`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    cliError(`Failed to register server: ${message}`);
    process.exit(1);
  }
}
