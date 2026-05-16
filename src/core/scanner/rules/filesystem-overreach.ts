import type { ScanRule, ScanFinding } from "../types.ts";

const DANGEROUS_FILESYSTEM_PATTERNS = [
  // System directories writes
  /\/etc\//g,
  /\/usr\/(local\/)?bin\//g,
  /\/usr\/share\//g,
  /\/boot\//g,
  /\/kernel/g,

  // Sensitive user directories
  /\/root\//g,
  /\/home\/[^/]+\/\.ssh\//g,
  /\/home\/[^/]+\/\.gnupg\//g,
  /~\/\.ssh\//g,
  /~\/\.gnupg\//g,
  /~\/\.aws\//g,

  // Config file writes
  /\.ssh\/id_rsa/g,
  /\.ssh\/authorized_keys/g,
  /\.ssh\/config/g,
  /\.gnupg\//g,
  /\.aws\/credentials/g,

  // Critical system files
  /\/etc\/passwd/g,
  /\/etc\/shadow/g,
  /\/etc\/sudoers/g,
  /\/etc\/hosts/g,

  // Library injection paths
  /\/usr\/lib\//g,
  /\/usr\/lib64\//g,
  /\.so(\.\d+)*$/g,
  /\.dylib$/g,

  // Launch daemons / services
  /\/Library\/LaunchDaemons\//g,
  /\/System\/Library\//g,
  /\/etc\/systemd\//g,
  /\/etc\/init\.d\//g,
];

const WRITE_PATTERNS = [
  /writeFile/gi,
  /writeFileSync/gi,
  /fs\.write/gi,
  /mkdir.*\/(etc|root|home)/gi,
  /chmod.*777/gi,
  /chown.*root/gi,
];

export const filesystemOverreachRule: ScanRule = {
  id: "filesystem-overreach",
  name: "Filesystem Overreach Detection",
  description: "Detects attempts to write to sensitive system directories",
  category: "security",
  severity: "error",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for write operations near sensitive paths
      for (const writePattern of WRITE_PATTERNS) {
        if (writePattern.test(line)) {
          // Check if any dangerous paths are in the same line
          for (const pathPattern of DANGEROUS_FILESYSTEM_PATTERNS) {
            const pathMatch = line.match(pathPattern);
            if (pathMatch) {
              findings.push({
                ruleId: this.id,
                severity: "error",
                message: `Write operation to sensitive path detected: "${pathMatch[0]}"`,
                line: i + 1,
                snippet: trimmed.substring(0, 80),
              });
            }
          }
        }
      }

      // Check for dangerous paths in general
      for (const pattern of DANGEROUS_FILESYSTEM_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            // Skip if it's just a comment mentioning the path
            if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
              continue;
            }

            findings.push({
              ruleId: this.id,
              severity: "error",
              message: `Sensitive filesystem path detected: "${match[0]}"`,
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
