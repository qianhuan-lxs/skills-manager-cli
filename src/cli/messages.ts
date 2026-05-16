import chalk from "chalk";

export type OutputFormat = "terminal" | "json" | "markdown";

let currentFormat: OutputFormat = "terminal";

export function setOutputFormat(format: OutputFormat): void {
  currentFormat = format;
}

export function getOutputFormat(): OutputFormat {
  return currentFormat;
}

export function cliInfo(message: string): void {
  if (currentFormat === "json") return;
  console.log(chalk.blue("ℹ") + " " + message);
}

export function cliSuccess(message: string): void {
  if (currentFormat === "json") return;
  console.log(chalk.green("✔") + " " + message);
}

export function cliWarn(message: string): void {
  if (currentFormat === "json") return;
  console.log(chalk.yellow("⚠") + " " + message);
}

export function cliError(message: string): void {
  if (currentFormat === "json") {
    console.log(JSON.stringify({ error: message }));
    return;
  }
  console.error(chalk.red("✖") + " " + message);
}

export function cliResult(data: unknown): void {
  switch (currentFormat) {
    case "json":
      console.log(JSON.stringify(data, null, 2));
      break;
    case "markdown":
      console.log("```json");
      console.log(JSON.stringify(data, null, 2));
      console.log("```");
      break;
    default:
      break;
  }
}
