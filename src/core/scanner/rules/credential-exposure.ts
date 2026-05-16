import type { ScanRule, ScanFinding } from "../types.js";

// API Key patterns (detects but allows safe usages in comments/examples)
const CREDENTIAL_PATTERNS = [
  // Stripe API keys
  /sk_(live|test)_[A-Za-z0-9]{24,}/g,

  // Slack tokens
  /xox[baprs]-[A-Za-z0-9-]{10,}/g,

  // AWS Access Keys
  /AKIA[0-9A-Z]{16}/g,
  /(?<![A-Za-z0-9/+=])[0-9A-Za-z/+=]{40}(?![A-Za-z0-9/+=])/g, // AWS Secret Key like

  // GitHub tokens
  /ghp_[A-Za-z0-9]{36}/g,
  /gho_[A-Za-z0-9]{36}/g,
  /ghu_[A-Za-z0-9]{36}/g,
  /ghs_[A-Za-z0-9]{36}/g,
  /ghr_[A-Za-z0-9]{36}/g,

  // JWT tokens
  /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g,

  // API keys in general
  /api[_-]?key["']?\s*[:=]\s*["']?[A-Za-z0-9_-]{20,}["']?/gi,

  // Bearer tokens
  /bearer\s+[A-Za-z0-9_-]{20,}/gi,

  // Password assignments
  /password["']?\s*[:=]\s*["'][^"']{8,}["']/gi,

  // Secret tokens
  /secret["']?\s*[:=]\s*["'][A-Za-z0-9_-]{16,}["']/gi,
];

const CREDIT_CARD_PATTERN = /\b(?:4[0-9]{12}(?:[0-9]{3})?|5[1-5][0-9]{14}|3[47][0-9]{13}|3(?:0[0-5]|[68][0-9])[0-9]{11}|6(?:011|5[0-9]{2})[0-9]{12}|(?:2131|1800|35\d{3})\d{11})\b/g;

export const credentialExposureRule: ScanRule = {
  id: "credential-exposure",
  name: "Credential Exposure Detection",
  description: "Detects exposed API keys, tokens, and other credentials",
  category: "security",
  severity: "error",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Skip comment lines for some patterns (false positive reduction)
      const isComment = trimmed.startsWith("//") || trimmed.startsWith("#") || trimmed.startsWith("/*");

      // Check credential patterns
      for (const pattern of CREDENTIAL_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            // Skip obvious examples/demos
            const context = line.substring(Math.max(0, match.index - 10), match.index + match[0].length + 10);
            if (context.toLowerCase().includes("example") ||
                context.toLowerCase().includes("your_") ||
                context.toLowerCase().includes("placeholder") ||
                context.toLowerCase().includes("<") ||
                context.toLowerCase().includes("xxx")) {
              continue;
            }

            findings.push({
              ruleId: this.id,
              severity: isComment ? "info" : "error",
              message: `Potential credential detected: ${match[0].substring(0, 10)}...`,
              line: i + 1,
              column: match.index + 1,
              snippet: trimmed,
            });
          }
        }
      }

      // Check credit card pattern
      const ccMatches = line.matchAll(CREDIT_CARD_PATTERN);
      for (const match of ccMatches) {
        if (match.index !== undefined) {
          findings.push({
            ruleId: this.id,
            severity: "error",
            message: `Potential credit card number detected`,
            line: i + 1,
            column: match.index + 1,
            snippet: trimmed,
          });
        }
      }
    }

    return findings;
  },
};
