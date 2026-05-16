import type { ScanRule, ScanFinding } from "../types.js";

const EXCESSIVE_PERMISSION_PATTERNS = [
  // Wildcard access patterns
  /\*{2,}|\.{3,}/g,
  /allow[_-]?all\s*[:=]\s*true/gi,
  /permit[_-]?all\s*[:=]\s*true/gi,
  /access[_-]?all\s*[:=]\s*true/gi,

  // Dangerous permission combinations
  /read[_-]?write.*delete/gi,
  /full[_-]?access/gi,
  /unrestricted/gi,
  /unlimited/gi,

  // Privilege escalation
  /sudo.*without.*password/gi,
  /nopasswd/gi,
  /root\s*[:=]\s*true/gi,

  // Bypass patterns
  /bypass.*auth/gi,
  /skip.*auth/gi,
  /no.*auth/gi,
  /disable.*check/gi,
  /override.*permission/gi,

  // Admin/owner patterns
  /is[_-]?admin\s*[:=]\s*true/gi,
  /is[_-]?owner\s*[:=]\s*true/gi,
  /role\s*[:=]\s*["']?admin/gi,
  /role\s*[:=]\s*["']?superuser/gi,
];

export const mcpPermissionOverreachRule: ScanRule = {
  id: "mcp-permission-overreach",
  name: "MCP Permission Overreach Detection",
  description: "Detects excessive permission requests in MCP tool definitions",
  category: "security",
  severity: "warn",
  check(content: string, frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    // Check frontmatter for permission metadata
    const permissions = frontmatter.permissions as string[] | undefined;
    if (permissions) {
      for (const perm of permissions) {
        if (perm === "*" || perm.includes("**") || perm.toLowerCase().includes("all")) {
          findings.push({
            ruleId: this.id,
            severity: "error",
            message: `Wildcard permission detected in frontmatter: "${perm}"`,
            snippet: `permissions: ${perm}`,
          });
        }
      }
    }

    // Check for dangerous permission patterns in body
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      for (const pattern of EXCESSIVE_PERMISSION_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              ruleId: this.id,
              severity: "warn",
              message: `Excessive permission pattern detected: "${match[0]}"`,
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
