export interface HealthIssue {
  type: "duplicate" | "outdated" | "orphan" | "conflict" | "error";
  severity: "error" | "warn" | "info";
  message: string;
  path?: string;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  issues: HealthIssue[];
  summary: {
    total: number;
    byType: Record<string, number>;
    bySeverity: Record<string, number>;
  };
  healthy: boolean;
}

export interface SkillInfo {
  path: string;
  name: string;
  description: string;
  version?: string;
  namespace?: string;
  mtime: number;
}
