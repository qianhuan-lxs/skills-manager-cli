import type { ScanRule, ScanResult, ScanFinding } from "./types.js";
import { commandInjectionRule } from "./rules/command-injection.js";
import { pathTraversalRule } from "./rules/path-traversal.js";
import { credentialExposureRule } from "./rules/credential-exposure.js";
import { promptInjectionRule } from "./rules/prompt-injection.js";
import { mcpPermissionOverreachRule } from "./rules/mcp-permission-overreach.js";
import { filesystemOverreachRule } from "./rules/filesystem-overreach.js";
import { networkExfiltrationRule } from "./rules/network-exfiltration.js";
import { supplyChainRule } from "./rules/supply-chain.js";
import { formatComplianceRule } from "./rules/format-compliance.js";

const ALL_RULES: ScanRule[] = [
  commandInjectionRule,
  pathTraversalRule,
  credentialExposureRule,
  promptInjectionRule,
  mcpPermissionOverreachRule,
  filesystemOverreachRule,
  networkExfiltrationRule,
  supplyChainRule,
  formatComplianceRule,
];

const SEVERITY_PENALTIES = {
  error: 15,
  warn: 5,
  info: 1,
};

export class ScanEngine {
  private rules: ScanRule[];

  constructor(customRules: ScanRule[] = []) {
    this.rules = customRules.length > 0 ? customRules : ALL_RULES;
  }

  scan(content: string, frontmatter: Record<string, unknown>): ScanResult {
    const allFindings: ScanFinding[] = [];
    const ruleResults = new Map<string, ScanFinding[]>();

    for (const rule of this.rules) {
      const findings = rule.check(content, frontmatter);
      if (findings.length > 0) {
        ruleResults.set(rule.id, findings);
        allFindings.push(...findings);
      }
    }

    const summary = {
      error: allFindings.filter((f) => f.severity === "error").length,
      warn: allFindings.filter((f) => f.severity === "warn").length,
      info: allFindings.filter((f) => f.severity === "info").length,
    };

    const penaltyTotal =
      summary.error * SEVERITY_PENALTIES.error +
      summary.warn * SEVERITY_PENALTIES.warn +
      summary.info * SEVERITY_PENALTIES.info;

    const riskScore = Math.max(0, 100 - penaltyTotal);

    return {
      findings: allFindings,
      riskScore,
      ruleResults,
      summary,
    };
  }

  getRules(): ScanRule[] {
    return [...this.rules];
  }

  getRuleById(id: string): ScanRule | undefined {
    return this.rules.find((r) => r.id === id);
  }
}

export { ALL_RULES };
