import { incrementCounter } from "../core/evolution/index.js";

export async function handleTickAction(): Promise<void> {
  const count = incrementCounter();
  const SKILL_NUDGE_THRESHOLD = 20;

  if (count === SKILL_NUDGE_THRESHOLD) {
    console.log(`[skm] Iteration ${count} reached. Consider whether the current workflow contains a reusable skill pattern. Review the skm-skill-creation-guide skill for guidance.`);
  } else if (count > SKILL_NUDGE_THRESHOLD && count % 10 === 0) {
    console.log(`[skm] Iteration ${count}. You have done significant work since the last skill was created. Look for skill-worthy patterns.`);
  }
}
