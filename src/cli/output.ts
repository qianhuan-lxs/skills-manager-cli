import chalk from "chalk";
import { getOutputFormat } from "./messages.js";

const CHAR_LIMIT = 25_000;

export function truncateOutput(text: string, limit = CHAR_LIMIT): string {
  if (text.length <= limit) return text;
  return text.slice(0, limit) + `\n... (truncated at ${limit} chars)`;
}

export function formatSkillList(
  skills: Array<{ name: string; namespace?: string; description?: string; state?: string }>,
): string {
  const fmt = getOutputFormat();
  if (fmt === "json") {
    return JSON.stringify(skills, null, 2);
  }
  return skills
    .map((s) => {
      const prefix = s.namespace ? `${s.namespace}:` : "";
      const state = s.state ? chalk.gray(` [${s.state}]`) : "";
      return `  ${chalk.cyan(prefix + s.name)}${state} — ${s.description ?? ""}`;
    })
    .join("\n");
}

export function formatRiskScore(score: number): string {
  const fmt = getOutputFormat();
  if (fmt === "json") return String(score);
  if (score >= 80) return chalk.green(`${score}/100 (safe)`);
  if (score >= 50) return chalk.yellow(`${score}/100 (warning)`);
  return chalk.red(`${score}/100 (danger)`);
}

export function formatTable(headers: string[], rows: string[][]): string {
  const fmt = getOutputFormat();
  if (fmt === "json") {
    return JSON.stringify(rows.map((r) => Object.fromEntries(headers.map((h, i) => [h, r[i]]))), null, 2);
  }
  const colWidths = headers.map((h, i) => Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)) + 2);
  const headerLine = headers.map((h, i) => h.padEnd(colWidths[i]!)).join("");
  const separator = colWidths.map((w) => "─".repeat(w)).join("─");
  const dataLines = rows.map((r) => r.map((c, i) => (c ?? "").padEnd(colWidths[i]!)).join(""));
  return [chalk.bold(headerLine), separator, ...dataLines].join("\n");
}

export function paginate<T>(
  items: T[],
  offset = 0,
  limit = 50,
): { data: T[]; total: number; has_more: boolean; next_offset: number | null } {
  const total = items.length;
  const data = items.slice(offset, offset + limit);
  const has_more = offset + limit < total;
  return {
    data,
    total,
    has_more,
    next_offset: has_more ? offset + limit : null,
  };
}
