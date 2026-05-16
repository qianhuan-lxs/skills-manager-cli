import type { ScanRule, ScanFinding } from "../types.js";

const PATH_TRAVERSAL_PATTERNS = [
  // Directory traversal
  /\.\.\.\//g,
  /\.\.\/\.\./g,
  /\.\.\\\\/g,

  // Absolute paths outside project
  /^\/(etc|usr|var|bin|sbin|root|home)\b/gm,
  /^~\/(\.(ssh|gnupg|aws|config))\b/gm,

  // Suspicious path operations
  /\.\.\/\s*\+/g,
  /\.\.\/\s*"/g,
  /\.\.\/\s*'/g,

  // Path concatenation with user input
  /path\s*\+\s*["']\.\.\//gi,
  /path\s*\+\s*user/gi,
  /path\s*\+\s*input/gi,
];

const DANGEROUS_PATHS = [
  "/etc/passwd",
  "/etc/shadow",
  "../../../etc/passwd",
  "..\\..\\..\\windows\\system32",
  "~/.ssh/id_rsa",
  "~/.ssh/authorized_keys",
  "~/.aws/credentials",
];

export const pathTraversalRule: ScanRule = {
  id: "path-traversal",
  name: "Path Traversal Detection",
  description: "Detects path traversal attempts and access to sensitive system paths",
  category: "security",
  severity: "error",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for dangerous path strings
      for (const dangerousPath of DANGEROUS_PATHS) {
        if (line.includes(dangerousPath)) {
          findings.push({
            ruleId: this.id,
            severity: "error",
            message: `Sensitive path access detected: "${dangerousPath}"`,
            line: i + 1,
            snippet: trimmed,
          });
        }
      }

      // Check regex patterns
      for (const pattern of PATH_TRAVERSAL_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              ruleId: this.id,
              severity: match[0].startsWith("/etc") ? "error" : "warn",
              message: `Path traversal pattern detected: "${match[0]}"`,
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
