export type Severity = "error" | "warn" | "info";

export interface ScanRule {
  id: string;
  name: string;
  description: string;
  category: "security" | "safety" | "compliance" | "quality";
  severity: Severity;
  check: (content: string, frontmatter: Record<string, unknown>) => ScanFinding[];
}

export interface ScanFinding {
  ruleId: string;
  severity: Severity;
  message: string;
  line?: number;
  column?: number;
  snippet?: string;
}

export interface ScanResult {
  findings: ScanFinding[];
  riskScore: number;
  ruleResults: Map<string, ScanFinding[]>;
  summary: {
    error: number;
    warn: number;
    info: number;
  };
}
