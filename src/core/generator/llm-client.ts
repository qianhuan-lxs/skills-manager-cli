import OpenAI from "openai";
import { resolveLlmConfig } from "../../cli/config.js";

export interface LlmOverrides {
  baseUrl?: string;
  apiKey?: string;
  model?: string;
}

export async function generateWithLlm(
  systemPrompt: string,
  userPrompt: string,
  overrides?: LlmOverrides,
): Promise<string> {
  const config = resolveLlmConfig(overrides);
  if (!config) {
    throw new Error(
      "LLM not configured. Run `skm init` or set SKM_BASE_URL and SKM_API_KEY environment variables.",
    );
  }

  const client = new OpenAI({
    baseURL: config.baseUrl,
    apiKey: config.apiKey,
  });

  const response = await client.chat.completions.create({
    model: config.model ?? "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
  });

  const content = response.choices[0]?.message?.content;
  if (!content) {
    throw new Error("LLM returned empty response");
  }
  return content;
}
