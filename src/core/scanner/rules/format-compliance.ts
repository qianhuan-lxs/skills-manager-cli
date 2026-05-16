import type { ScanRule, ScanFinding } from "../types.ts";

const REQUIRED_FIELDS = ["name", "description"];

const TYPE_VALIDATION_RULES = {
  name: "string",
  description: "string",
  version: "string",
  apiVersion: "number",
};

const FIELD_VALUE_PATTERNS = {
  // Name should be kebab-case
  name: /^[a-z][a-z0-9-]*[a-z0-9]$/,
  // Description should be sentence case (basic check)
  description: /^[A-Z].*[a-z]$/,
};

export const formatComplianceRule: ScanRule = {
  id: "format-compliance",
  name: "Format Compliance Check",
  description: "Validates SKILL.md frontmatter format compliance",
  category: "compliance",
  severity: "error",
  check(_content: string, frontmatter: Record<string, unknown>): ScanFinding[] {
    const findings: ScanFinding[] = [];

    // Check required fields exist
    for (const field of REQUIRED_FIELDS) {
      if (!(field in frontmatter)) {
        findings.push({
          ruleId: this.id,
          severity: "error",
          message: `Missing required frontmatter field: "${field}"`,
          snippet: `Add: ${field}: "value"`,
        });
      }
    }

    // Check field types
    for (const [field, expectedType] of Object.entries(TYPE_VALIDATION_RULES)) {
      if (field in frontmatter) {
        const value = frontmatter[field];
        const actualType = Array.isArray(value) ? "array" : typeof value;

        if (actualType !== expectedType) {
          findings.push({
            ruleId: this.id,
            severity: "error",
            message: `Field "${field}" has wrong type: expected ${expectedType}, got ${actualType}`,
            snippet: `${field}: ${JSON.stringify(value)}`,
          });
        }
      }
    }

    // Check name format (kebab-case)
    if (typeof frontmatter.name === "string") {
      if (!FIELD_VALUE_PATTERNS.name.test(frontmatter.name)) {
        findings.push({
          ruleId: this.id,
          severity: "warn",
          message: `Field "name" should be kebab-case (lowercase with hyphens, no spaces)`,
          snippet: `name: "${frontmatter.name}"`,
        });
      }
    }

    // Check description format
    if (typeof frontmatter.description === "string") {
      const desc = frontmatter.description.trim();

      // Description should be reasonable length
      if (desc.length < 10) {
        findings.push({
          ruleId: this.id,
          severity: "warn",
          message: `Field "description" is too short (minimum 10 characters)`,
          snippet: `description: "${desc}"`,
        });
      }

      if (desc.length > 200) {
        findings.push({
          ruleId: this.id,
          severity: "info",
          message: `Field "description" is very long (consider concise description under 200 chars)`,
          snippet: `description: "${desc.substring(0, 50)}..."`,
        });
      }
    }

    return findings;
  },
};
