import { incrementCounter } from "../core/evolution/index.js";
import { cliInfo } from "../cli/messages.js";

export async function handleTickAction(): Promise<void> {
  const count = incrementCounter();
  cliInfo(`Iteration count: ${count}`);
}
