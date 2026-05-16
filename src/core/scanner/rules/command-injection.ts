import type { ScanRule, ScanFinding } from "../types.js";

const COMMAND_INJECTION_PATTERNS = [
  // Dangerous rm commands
  /\brm\s+(-rf?|--recursive)\s+[~/]/gi,
  /\brm\s+(-rf?|--recursive)\s+\*\*/gi,
  /\brm\s+-rf\s+\//gi,

  // Pipe to shell
  /\bcurl(\s+\S+)?\s*\|\s*(bash|sh|zsh|ksh)/gi,
  /\bwget(\s+\S+)?\s*\|\s*(bash|sh|zsh|ksh)/gi,
  /\bfetch(\s+\S+)?\s*\|\s*(bash|sh|zsh|ksh)/gi,

  // Command substitution
  /\$\([^)]*\)/g,
  /`[^`]+`/g,
  /\$\{[^}]*\}/g,

  // eval statements
  /\beval\s*\(/gi,
  /\beval\s+"[^"]*"/gi,
  /\beval\s+'[^']*'/gi,

  // Dangerous pipe chains
  /\|\s*xargs\s+rm\s+/gi,
  /\|\s*sh\s+-c/gi,
  /\|\s*bash\s+-c/gi,
];

const TRIGGER_STRINGS = [
  "rm -rf /",
  "rm -rf ~/",
  "rm -rf *",
  "curl | bash",
  "curl | sh",
  "wget | sh",
  "eval $(",
  "exec(",
  "child_process.exec",
];

export const commandInjectionRule: ScanRule = {
  id: "command-injection",
  name: "Command Injection Detection",
  description: "Detects potentially dangerous command execution patterns",
  category: "security",
  severity: "error",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for exact dangerous strings
      for (const trigger of TRIGGER_STRINGS) {
        if (line.toLowerCase().includes(trigger.toLowerCase())) {
          findings.push({
            ruleId: this.id,
            severity: "error",
            message: `Dangerous command pattern detected: "${trigger}"`,
            line: i + 1,
            snippet: trimmed,
          });
        }
      }

      // Check regex patterns
      for (const pattern of COMMAND_INJECTION_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              ruleId: this.id,
              severity: "error",
              message: `Command injection pattern detected: "${match[0]}"`,
              line: i + 1,
              column: match.index + 1,
              snippet: trimmed,
            });
          }
        }
      }
    }

    return findings;
  },
};
