import type { ScanRule, ScanFinding } from "../types.ts";

const SUPPLY_CHAIN_PATTERNS = [
  // curl|sh execution (dangerous)
  /curl\s+\S+\s*\|\s*(sh|bash|zsh)/gi,
  /wget\s+\S+\s*\|\s*(sh|bash|zsh)/gi,
  /fetch\s+\S+\s*\|\s*(sh|bash|zsh)/gi,

  // npx with -y flag (auto-confirm, potential risk)
  /npx\s+-y\s+/gi,
  /npx\s+--yes\s+/gi,

  // npm install with unsafe flags
  /npm\s+install\s+--force/gi,
  /npm\s+i\s+--force/gi,
  /npm\s+install\s+--legacy-peer-deps/gi,

  // Unpinned dependencies (no version specified)
  /npm\s+install\s+[a-z][a-z0-9-]*(?!\s*@\d)/gi,
  /yarn\s+add\s+[a-z][a-z0-9-]*(?!\s*@\d)/gi,
  /pnpm\s+add\s+[a-z][a-z0-9-]*(?!\s*@\d)/gi,

  // Arbitrary package execution
  /npx\s+[a-z][a-z0-9-]+(?!\s+@)/gi,
  /npx\s+[^/]+\/[^/\s]+/gi, // npx user/repo

  // Scripts from remote
  /source\s+<\([^)]*\)/g,
  /\.\s+<\([^)]*\)/g,
  /eval\s*\(\s*\$\(/g,

  // Docker image from untrusted source
  /docker\s+run\s+(?!.*--security-opt)/gi,
  /FROM\s+[a-z]+\/[a-z]+(?!\s*:\s*[\d])/gi,
];

const UNPINNED_URL_PATTERNS = [
  /https?:\/\/(?:www\.)?raw\.githubusercontent\.com\/[^/]+\/[^/]+\/master\//gi,
  /https?:\/\/(?:www\.)?raw\.githubusercontent\.com\/[^/]+\/[^/]+\/main\//gi,
  /https?:\/\/gist\.githubusercontent\.com\/[a-f0-9]+\/raw\//gi,
  /https?:\/\/pastebin\.com\/raw\//gi,
];

export const supplyChainRule: ScanRule = {
  id: "supply-chain",
  name: "Supply Chain Security Detection",
  description: "Detects risky package execution and unpinned dependencies",
  category: "security",
  severity: "warn",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment lines
      if (trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("*")) {
        continue;
      }

      // Check for unpinned URLs (branch pointers instead of commits/tags)
      for (const pattern of UNPINNED_URL_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              ruleId: this.id,
              severity: "warn",
              message: `Unpinned dependency URL detected: content may change unexpectedly`,
              line: i + 1,
              column: match.index + 1,
              snippet: trimmed.substring(0, 80),
            });
          }
        }
      }

      // Check supply chain patterns
      for (const pattern of SUPPLY_CHAIN_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            const isCurlPipeSh = /curl.*\|.*sh|bash/i.test(match[0]);
            findings.push({
              ruleId: this.id,
              severity: isCurlPipeSh ? "error" : "warn",
              message: `Supply chain risk detected: "${match[0]}"`,
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
