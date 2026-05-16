import type { ScanRule, ScanFinding } from "../types.ts";

const EXFILTRATION_PATTERNS = [
  // DNS exfiltration patterns
  /dig\s+.*\s+@[\d.]+/gi,
  /nslookup\s+.*\s+[\d.]+/gi,
  /\.lookup\(".*"\)/gi,

  // External data posting
  /fetch\s*\(\s*["']https?:\/\/.*["']\s*,\s*\{[^}]*method\s*:\s*["']POST/gi,
  /axios\.post\s*\(/gi,
  /http\.post\s*\(/gi,
  /xmlhttprequest.*post/gi,

  // Webhook patterns
  /webhook\.site/gi,
  /requestbin\./gi,
  /hook\.relay\./gi,
  /glitch\.me/gi,
  /ngrok\.io/gi,
  /pastebin\./gi,
  /godbolt\.org/gi,
  /t\.io/gi,
  /dumpz\.org/gi,

  // Data encoding for exfiltration
  /btoa\s*\(/gi,
  /base64\.encode/gi,
  /Buffer\.from\(.*\)\.toString\(["']base64["']\)/gi,

  // Suspicious URLs
  /https?:\/\/(?:[\w-]+\.)?exfil/gi,
  /https?:\/\/(?:[\w-]+\.)?steal/gi,
  /https?:\/\/(?:[\w-]+\.)?leak/gi,
];

const SUSPICIOUS_DOMAINS = [
  "webhook.site",
  "requestbin.net",
  "paste.ee",
  "hastebin.com",
  "pastebin.com",
  "dpaste.com",
  "clbin.com",
  "ptpb.pw",
  "0x0.st",
  "transfer.sh",
  "file.io",
];

export const networkExfiltrationRule: ScanRule = {
  id: "network-exfiltration",
  name: "Network Exfiltration Detection",
  description: "Detects potential data exfiltration via network requests",
  category: "security",
  severity: "warn",
  check(content: string, _frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];
    const lines = content.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmed = line.trim();

      // Check for suspicious domains
      for (const domain of SUSPICIOUS_DOMAINS) {
        if (line.toLowerCase().includes(domain.toLowerCase())) {
          findings.push({
            ruleId: this.id,
            severity: "warn",
            message: `Suspicious external domain detected: "${domain}"`,
            line: i + 1,
            snippet: trimmed.substring(0, 80),
          });
        }
      }

      // Check exfiltration patterns
      for (const pattern of EXFILTRATION_PATTERNS) {
        const matches = line.matchAll(pattern);
        for (const match of matches) {
          if (match.index !== undefined) {
            findings.push({
              ruleId: this.id,
              severity: "warn",
              message: `Potential exfiltration pattern detected: "${match[0]}"`,
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
