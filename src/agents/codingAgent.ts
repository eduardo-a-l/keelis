import type { ConverseMessage, ToolCapableProvider } from "../providers/converse.js";
import type { ToolExecutor } from "../tools/executor.js";
import type { ToolDefinition } from "../tools/types.js";
import type { Agent, AgentContext, AgentResult } from "./index.js";

const REPORT_BLOCKER_TOOL: ToolDefinition = {
  name: "report_blocker",
  description:
    "Call this instead of finishing if the task cannot be completed until something else is done first. This creates a new tracked task for the prerequisite.",
  parameters: {
    type: "object",
    properties: {
      id: { type: "string" },
      title: { type: "string" },
      description: { type: "string" },
      reason: { type: "string" }
    },
    required: ["id", "title", "description", "reason"]
  }
};

function systemPrompt(): string {
  return [
    "You are an autonomous coding agent working on one task at a time inside a real project directory.",
    "Use the available tools to inspect the project and make the changes the task requires.",
    "When the task is fully done, respond with plain text and no tool calls, summarizing exactly what you changed.",
    "If you cannot proceed because something else needs to happen first, call report_blocker instead of guessing or giving up."
  ].join("\n");
}

function taskPrompt(context: AgentContext): string {
  return [
    `Task title: ${context.task.title}`,
    `Task description: ${context.task.description}`
  ].join("\n");
}

export interface CodingAgentOptions {
  maxSteps?: number;
}

interface BlockerInput extends Record<string, unknown> {
  id: string;
  title: string;
  description: string;
  reason: string;
}

function isBlockerInput(input: Record<string, unknown>): input is BlockerInput {
  return (
    typeof input.id === "string" &&
    typeof input.title === "string" &&
    typeof input.description === "string" &&
    typeof input.reason === "string"
  );
}

export class CodingAgent implements Agent {
  name = "coding-agent";
  private readonly maxSteps: number;

  constructor(
    private readonly provider: ToolCapableProvider,
    private readonly executor: ToolExecutor,
    options: CodingAgentOptions = {}
  ) {
    this.maxSteps = options.maxSteps ?? 8;
  }

  async run(context: AgentContext): Promise<AgentResult> {
    const tools = [...this.executor.definitions(), REPORT_BLOCKER_TOOL];
    const messages: ConverseMessage[] = [{ role: "user", content: taskPrompt(context) }];

    for (let step = 0; step < this.maxSteps; step += 1) {
      const response = await this.provider.converse({
        system: systemPrompt(),
        messages,
        tools,
        maxTokens: 1500
      });

      if (response.toolCalls.length === 0) {
        return { success: true, summary: response.text };
      }

      messages.push({ role: "assistant", content: response.text, toolCalls: response.toolCalls });

      for (const call of response.toolCalls) {
        if (call.name === "report_blocker" && isBlockerInput(call.input)) {
          context.graph.spawnTask(context.task.id, call.input);
          return { success: false, summary: `Blocked: ${call.input.reason}` };
        }

        const result = await this.executor.execute(call);
        messages.push(
          result.isError === undefined
            ? { role: "tool_result", toolCallId: call.id, content: result.output }
            : {
                role: "tool_result",
                toolCallId: call.id,
                content: result.output,
                isError: result.isError
              }
        );
      }
    }

    return {
      success: false,
      summary: `Exceeded ${this.maxSteps} tool-use steps without finishing`
    };
  }
}
