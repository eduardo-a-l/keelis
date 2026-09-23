import { describe, expect, it } from "vitest";
import { CodingAgent } from "../../src/agents/codingAgent.js";
import { TaskGraph } from "../../src/core/graph.js";
import type { Task } from "../../src/core/task.js";
import type {
  ConverseRequest,
  ConverseResponse,
  ToolCapableProvider
} from "../../src/providers/converse.js";
import type { CompletionRequest, CompletionResult } from "../../src/providers/provider.js";
import { ToolExecutor } from "../../src/tools/executor.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: "t1",
    missionId: "m1",
    title: "task",
    description: "do the thing",
    status: "RUNNING",
    dependsOn: [],
    createdBy: "planner",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

class ScriptedProvider implements ToolCapableProvider {
  name = "scripted";
  calls = 0;

  constructor(private readonly responses: ConverseResponse[]) {}

  async complete(_request: CompletionRequest): Promise<CompletionResult> {
    return { text: "" };
  }

  async converse(_request: ConverseRequest): Promise<ConverseResponse> {
    const response = this.responses[this.calls];
    this.calls += 1;
    if (!response) {
      throw new Error("ScriptedProvider ran out of responses");
    }
    return response;
  }
}

function makeExecutor(): ToolExecutor {
  return new ToolExecutor({ workdir: "/tmp", permission: "AUTO", confirm: async () => true });
}

describe("CodingAgent", () => {
  it("finishes immediately when the model responds with no tool calls", async () => {
    const provider = new ScriptedProvider([
      { text: "Nothing to do here.", toolCalls: [], stopReason: "end_turn" }
    ]);
    const agent = new CodingAgent(provider, makeExecutor());
    const graph = new TaskGraph([makeTask()]);

    const result = await agent.run({ task: makeTask(), graph });

    expect(result).toEqual({ success: true, summary: "Nothing to do here." });
    expect(provider.calls).toBe(1);
  });

  it("executes a tool call and feeds the result back before finishing", async () => {
    const provider = new ScriptedProvider([
      {
        text: "",
        toolCalls: [{ id: "c1", name: "list_directory", input: { path: "." } }],
        stopReason: "tool_use"
      },
      { text: "Done, saw the directory.", toolCalls: [], stopReason: "end_turn" }
    ]);
    const agent = new CodingAgent(provider, makeExecutor());
    const graph = new TaskGraph([makeTask()]);

    const result = await agent.run({ task: makeTask(), graph });

    expect(result.success).toBe(true);
    expect(provider.calls).toBe(2);
  });

  it("spawns a dependency task and stops when the model reports a blocker", async () => {
    const provider = new ScriptedProvider([
      {
        text: "",
        toolCalls: [
          {
            id: "c1",
            name: "report_blocker",
            input: {
              id: "t2",
              title: "missing dependency",
              description: "install the package first",
              reason: "package not installed"
            }
          }
        ],
        stopReason: "tool_use"
      }
    ]);
    const agent = new CodingAgent(provider, makeExecutor());
    const graph = new TaskGraph([makeTask({ id: "t1" })]);

    const result = await agent.run({ task: makeTask({ id: "t1" }), graph });

    expect(result.success).toBe(false);
    expect(result.summary).toContain("package not installed");
    expect(graph.getTask("t1")?.status).toBe("BLOCKED");
    expect(graph.getTask("t2")?.title).toBe("missing dependency");
  });

  it("stops after maxSteps without finishing", async () => {
    const provider = new ScriptedProvider(
      Array.from({ length: 5 }, (): ConverseResponse => ({
        text: "",
        toolCalls: [{ id: "c", name: "list_directory", input: { path: "." } }],
        stopReason: "tool_use"
      }))
    );
    const agent = new CodingAgent(provider, makeExecutor(), { maxSteps: 3 });
    const graph = new TaskGraph([makeTask()]);

    const result = await agent.run({ task: makeTask(), graph });

    expect(result.success).toBe(false);
    expect(result.summary).toContain("Exceeded 3 tool-use steps");
    expect(provider.calls).toBe(3);
  });
});
