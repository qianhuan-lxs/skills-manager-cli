import type { ScanRule, ScanFinding } from "../types.js";

const PROMPT_INJECTION_PATTERNS = [
  // Classic jailbreaks
  /ignore\s+(all\s+)?(previous|above|earlier|the)\s+(instructions?|commands?|prompts?|directives?)/gi,
  /disregard\s+(all\s+)?(previous|above|earlier|the)\s+(instructions?|commands?|prompts?|directives?)/gi,
  /forget\s+(all\s+)?(previous|above|earlier|the)\s+(instructions?|commands?|prompts?|directives?)/gi,
  /override\s+(all\s+)?(previous|above|earlier|the)\s+(instructions?|commands?|prompts?|directives?)/gi,

  // Role switching
  /you\s+are\s+now\s+(a|an|the)\s+/gi,
  /act\s+as\s+(a|an|the)\s+/gi,
  /pretend\s+to\s+be\s+/gi,
  /role[- ]?play\s+as\s+/gi,
  /assume\s+the\s+role\s+of\s+/gi,
  /from\s+now\s+on\s+you\s+are\s+/gi,

  // System prompt override attempts
  /system\s*:\s*/gi,
  /system\s+prompt\s*:/gi,
  /new\s+(instructions?|commands?|directives?)\s*:/gi,

  // Bypass attempts
  /bypass\s+(security|restrictions|filters|safety)/gi,
  /circumvent\s+(security|restrictions|filters|safety)/gi,
  /avoid\s+(security|restrictions|filters|safety)/gi,

  // Instruction injection
  /(instead|alternatively|rather),?\s+(please\s+)?/gi,
  /do\s+(not\s+)?follow\s+(the\s+)?(instructions?|guidelines?)/gi,

  // DAN and similar jailbreak patterns
  /\bDAN\b/gi,
  /developer\s+mode\s+enabled/gi,
  /unrestricted\s+mode/gi,
  /jailbreak\s+mode/gi,
  /above\s+guidelines?\s+do\s+not\s+apply/gi,
];

export const promptInjectionRule: ScanRule = {
  id: "prompt-injection",
  name: "Prompt Injection Detection",
  description: "Detects prompt injection and jailbreak attempts",
  category: "security",
  severity: "warn",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check prompt injection patterns
      for (const pattern of PROMPT_INJECTION_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            // Allow in code blocks or quoted strings (might be legitimate content)
            const isInCodeBlock = trimmed.startsWith("```") || trimmed.startsWith("    ");
            const isQuoted = /^['"]/.test(trimmed);

            findings.push({
              ruleId: this.id,
              severity: isInCodeBlock || isQuoted ? "info" : "warn",
              message: `Prompt injection pattern detected: "${match[0]}"`,
              line: i + 1,
              column: match.index + 1,
              snippet: trimmed.substring(0, 80),
            });
          }
        }
      }
    }

    return findings;
  },
};
