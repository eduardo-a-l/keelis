import type { Provider } from "../providers/provider.js";
import type { Agent, AgentContext, AgentResult } from "./index.js";

interface AgentBlocker {
  id: string;
  title: string;
  description: string;
  reason: string;
}

interface AgentDecision {
  status: "done" | "blocked";
  summary: string;
  blocker?: AgentBlocker;
}

function buildPrompt(context: AgentContext): string {
  return [
    "You are an autonomous engineering agent working on one task at a time.",
    "Either complete the task and summarize exactly what you did, or report",
    "that you are blocked by something that must be done first.",
    'Respond with JSON only, no prose: { "status": "done" | "blocked",',
    '"summary": string, "blocker"?: { "id": string, "title": string,',
    '"description": string, "reason": string } }.',
    'If blocked, "id" must be a short unique id unlike any existing task id.',
    "",
    `Task title: ${context.task.title}`,
    `Task description: ${context.task.description}`
  ].join("\n");
}

function stripFences(text: string): string {
  return text
    .trim()
    .replace(/^```json/, "")
    .replace(/^```/, "")
    .replace(/```$/, "")
    .trim();
}

function parseDecision(text: string): AgentDecision {
  const parsed = JSON.parse(stripFences(text)) as Partial<AgentDecision>;
  if (parsed.status !== "done" && parsed.status !== "blocked") {
    throw new Error("Agent response missing valid 'status'");
  }
  if (typeof parsed.summary !== "string") {
    throw new Error("Agent response missing 'summary'");
  }
  return parsed.blocker
    ? { status: parsed.status, summary: parsed.summary, blocker: parsed.blocker }
    : { status: parsed.status, summary: parsed.summary };
}

export class SimpleAgent implements Agent {
  name = "simple-agent";

  constructor(private readonly provider: Provider) {}

  async run(context: AgentContext): Promise<AgentResult> {
    const result = await this.provider.complete({
      prompt: buildPrompt(context),
      maxTokens: 800
    });
    const decision = parseDecision(result.text);

    if (decision.status === "blocked" && decision.blocker) {
      context.graph.spawnTask(context.task.id, decision.blocker);
      return { success: false, summary: decision.summary };
    }

    return { success: true, summary: decision.summary };
  }
}
