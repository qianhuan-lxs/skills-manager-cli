import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { saveConfig } from "../cli/config.js";
import { cliSuccess, cliError } from "../cli/messages.js";

const SKM_DIR = path.join(os.homedir(), ".skm");

export async function handleInitAction(): Promise<void> {
  try {
    // Create ~/.skm/ directory if not exists
    if (!fs.existsSync(SKM_DIR)) {
      fs.mkdirSync(SKM_DIR, { recursive: true });
    }

    // Check if already initialized
    const configPath = path.join(SKM_DIR, "config.json");
    if (fs.existsSync(configPath)) {
      cliError("SKM is already initialized. Config exists at " + configPath);
      process.exit(1);
    }

    // Interactive setup defaults
    const llmBaseUrl = process.env.SKIRM_INIT_BASE_URL ?? "https://api.openai.com/v1";
    const llmApiKey = process.env.SKIRM_INIT_API_KEY;
    const llmModel = process.env.SKIRM_INIT_MODEL ?? "gpt-4o";
    const defaultNamespace = process.env.SKIRM_INIT_NAMESPACE ?? "skm";

    if (!llmApiKey) {
      cliError("API key required. Set SKIRM_INIT_API_KEY environment variable.");
      process.exit(1);
    }

    // Save config
    saveConfig({
      llm: {
        baseUrl: llmBaseUrl,
        apiKey: llmApiKey,
        model: llmModel,
      },
      evolution: {
        staleAfterDays: 30,
        archiveAfterDays: 90,
        namespaces: defaultNamespace,
        nudgeInterval: 10,
      },
      output: {
        format: "terminal",
      },
    });

    cliSuccess("SKM initialized successfully");
    cliSuccess(`Config saved to ${configPath}`);
  } catch (error) {
    if (error instanceof Error) {
      cliError(error.message);
    } else {
      cliError("Failed to initialize SKM");
    }
    process.exit(1);
  }
}
