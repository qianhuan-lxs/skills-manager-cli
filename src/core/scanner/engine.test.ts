import { describe, it, expect } from "vitest";
import { ScanEngine } from "./engine.js";
import type { ScanRule, ScanFinding } from "./types.js";

function makeRule(
  id: string,
  severity: "error" | "warn" | "info",
  check: (content: string) => ScanFinding[],
): ScanRule {
  return {
    id,
    name: `Test rule ${id}`,
    description: "A test rule",
    category: "security",
    severity,
    check: (content: string, _fm: Record<string, unknown>) => check(content),
  };
}

describe("ScanEngine", () => {
  it("returns riskScore 100 for content with no issues", () => {
    const engine = new ScanEngine();
    const result = engine.scan(
      "This is a harmless greeting message.",
      { name: "my-skill", description: "A well-formed skill for demonstration purposes" },
    );
    expect(result.riskScore).toBe(100);
    expect(result.findings).toHaveLength(0);
    expect(result.summary.error).toBe(0);
    expect(result.summary.warn).toBe(0);
    expect(result.summary.info).toBe(0);
  });

  it("detects command injection with 'rm -rf /'", () => {
    const engine = new ScanEngine();
    const result = engine.scan("Run this command: rm -rf / to clean up", {});
    expect(result.findings.length).toBeGreaterThan(0);
    const cmdFindings = result.findings.filter(
      (f) => f.ruleId === "command-injection",
    );
    expect(cmdFindings.length).toBeGreaterThan(0);
    expect(cmdFindings.some((f) => f.severity === "error")).toBe(true);
  });

  it("detects credential exposure with API key pattern", () => {
    const engine = new ScanEngine();
    const content = `const API_KEY = sk_test_${"A".repeat(30)}`;
    const result = engine.scan(content, {});
    const credFindings = result.findings.filter(
      (f) => f.ruleId === "credential-exposure",
    );
    expect(credFindings.length).toBeGreaterThan(0);
  });

  it("detects path traversal with '../../../etc/passwd'", () => {
    const engine = new ScanEngine();
    const content = "Read file at ../../../etc/passwd";
    const result = engine.scan(content, {});
    const pathFindings = result.findings.filter(
      (f) => f.ruleId === "path-traversal",
    );
    expect(pathFindings.length).toBeGreaterThan(0);
    expect(pathFindings.some((f) => f.severity === "error")).toBe(true);
  });

  it("errors reduce risk score more than warnings", () => {
    const errorRule = makeRule("err-rule", "error", (content) => {
      if (content.includes("ERR")) {
        return [
          {
            ruleId: "err-rule",
            severity: "error",
            message: "error found",
          },
        ];
      }
      return [];
    });

    const warnRule = makeRule("warn-rule", "warn", (content) => {
      if (content.includes("WARN")) {
        return [
          {
            ruleId: "warn-rule",
            severity: "warn",
            message: "warning found",
          },
        ];
      }
      return [];
    });

    const engine = new ScanEngine([errorRule, warnRule]);

    const errorResult = engine.scan("ERR trigger", {});
    const warnResult = engine.scan("WARN trigger", {});

    // Error penalty is 15, warn penalty is 5
    expect(errorResult.riskScore).toBe(85);
    expect(warnResult.riskScore).toBe(95);

    // Error result should have lower score
    expect(errorResult.riskScore).toBeLessThan(warnResult.riskScore);
  });

  it("risk score never goes below 0", () => {
    // Create an engine with many error-producing rules
    const rules: ScanRule[] = [];
    for (let i = 0; i < 10; i++) {
      rules.push(
        makeRule(`err-${i}`, "error", () => [
          {
            ruleId: `err-${i}`,
            severity: "error",
            message: "error",
          },
        ]),
      );
    }
    const engine = new ScanEngine(rules);
    const result = engine.scan("anything", {});
    expect(result.riskScore).toBe(0);
  });

  it("populates ruleResults map with findings per rule", () => {
    const rule1 = makeRule("r1", "error", () => [
      { ruleId: "r1", severity: "error", message: "finding 1" },
    ]);
    const rule2 = makeRule("r2", "warn", () => []);

    const engine = new ScanEngine([rule1, rule2]);
    const result = engine.scan("anything", {});

    expect(result.ruleResults.has("r1")).toBe(true);
    expect(result.ruleResults.get("r1")).toHaveLength(1);
    expect(result.ruleResults.has("r2")).toBe(false);
  });

  it("getRules returns all registered rules", () => {
    const rule = makeRule("test", "info", () => []);
    const engine = new ScanEngine([rule]);
    expect(engine.getRules()).toHaveLength(1);
    expect(engine.getRules()[0]!.id).toBe("test");
  });

  it("getRuleById finds a specific rule", () => {
    const rule = makeRule("find-me", "info", () => []);
    const engine = new ScanEngine([rule]);
    expect(engine.getRuleById("find-me")).toBeDefined();
    expect(engine.getRuleById("nonexistent")).toBeUndefined();
  });
});
