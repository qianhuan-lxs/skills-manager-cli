import { Command } from "commander";
import { getConfigValue, setConfigValue, loadConfig } from "../cli/config.js";
import { cliResult, cliError, cliSuccess } from "../cli/messages.js";

export function registerConfigCommand(program: Command): void {
  const configCmd = program.command("config").description("Get or set configuration values");

  configCmd
    .command("get <key>")
    .description("Get a configuration value")
    .action((key: string) => {
      handleGet(key);
    });

  configCmd
    .command("set <key> <value>")
    .description("Set a configuration value")
    .action((key: string, value: string) => {
      handleSet(key, value);
    });

  configCmd
    .command("list")
    .description("List all configuration values")
    .action(() => {
      handleList();
    });
}

// Handler for config command (when called without subcommand)
export function handleConfig(): void {
  cliError("Please specify a subcommand: get, set, or list");
  process.exit(1);
}

function handleGet(key: string): void {
  const value = getConfigValue(key);
  if (value === undefined) {
    cliError(`Config key "${key}" not found`);
    process.exit(1);
  }
  cliResult({ key, value });
}

function handleSet(key: string, value: string): void {
  setConfigValue(key, value);
  cliSuccess(`Set ${key} = ${value}`);
}

function handleList(): void {
  const config = loadConfig();
  cliResult(config);
}
