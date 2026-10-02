import { describe, expect, it } from "vitest";
import type { Agent, AgentContext, AgentResult } from "../../src/agents/index.js";
import type { Checkpointer } from "../../src/core/checkpoint.js";
import { TaskGraph } from "../../src/core/graph.js";
import { MissionRunner } from "../../src/core/runner.js";
import type { Task } from "../../src/core/task.js";
import type { Reviewer, ReviewResult } from "../../src/core/review.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: "t1",
    missionId: "m1",
    title: "task",
    description: "do the thing",
    status: "QUEUED",
    dependsOn: [],
    createdBy: "planner",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

class FakeAgent implements Agent {
  name = "fake-agent";
  calls = 0;

  constructor(private readonly behavior: (context: AgentContext, call: number) => AgentResult) {}

  async run(context: AgentContext): Promise<AgentResult> {
    this.calls += 1;
    return this.behavior(context, this.calls);
  }
}

class FakeReviewer implements Reviewer {
  constructor(private readonly results: ReviewResult[]) {}

  async review(): Promise<ReviewResult> {
    return this.results.shift() ?? { approved: true, feedback: "" };
  }
}

class FakeCheckpointer implements Checkpointer {
  created: string[] = [];
  restored: string[] = [];
  private counter = 0;

  async create(label: string): Promise<string> {
    this.counter += 1;
    const id = `cp-${this.counter}`;
    this.created.push(`${id}:${label}`);
    return id;
  }

  async restore(checkpointId: string): Promise<void> {
    this.restored.push(checkpointId);
  }
}

describe("MissionRunner", () => {
  it("completes a task the reviewer approves on the first attempt", async () => {
    const graph = new TaskGraph([makeTask()]);
    const agent = new FakeAgent(() => ({ success: true, summary: "done" }));
    const reviewer = new FakeReviewer([{ approved: true, feedback: "looks good" }]);

    await new MissionRunner(graph, { agent, reviewer }).run();

    expect(graph.getTask("t1")?.status).toBe("COMPLETED");
    expect(agent.calls).toBe(1);
  });

  it("retries after a rejected review and completes once approved", async () => {
    const graph = new TaskGraph([makeTask()]);
    const agent = new FakeAgent(() => ({ success: true, summary: "attempt" }));
    const reviewer = new FakeReviewer([
      { approved: false, feedback: "missing tests" },
      { approved: true, feedback: "now it is fine" }
    ]);

    await new MissionRunner(graph, { agent, reviewer }).run();

    expect(graph.getTask("t1")?.status).toBe("COMPLETED");
    expect(agent.calls).toBe(2);
    expect(graph.getTask("t1")?.attempts).toBe(2);
  });

  it("cancels the task once max attempts is exceeded", async () => {
    const graph = new TaskGraph([makeTask()]);
    const agent = new FakeAgent(() => ({ success: true, summary: "attempt" }));
    const reviewer = new FakeReviewer([
      { approved: false, feedback: "no" },
      { approved: false, feedback: "still no" }
    ]);

    await new MissionRunner(graph, { agent, reviewer, maxAttempts: 2 }).run();

    expect(graph.getTask("t1")?.status).toBe("CANCELLED");
    expect(agent.calls).toBe(2);
  });

  it("stops without reviewing when the agent blocks the task", async () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "READY" })]);
    const agent = new FakeAgent((context) => {
      context.graph.spawnTask("t1", {
        id: "t2",
        title: "blocker",
        description: "must happen first",
        reason: "missing prerequisite"
      });
      return { success: false, summary: "blocked" };
    });
    const reviewer: Reviewer = {
      review: () => {
        throw new Error("reviewer should not be called while blocked");
      }
    };

    const runner = new MissionRunner(graph, { agent, reviewer });
    await runner.step("t1");

    expect(graph.getTask("t1")?.status).toBe("BLOCKED");
    expect(graph.getTask("t2")?.status).toBe("QUEUED");
  });

  it("resumes and completes the parent once its spawned child finishes", async () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "QUEUED" })]);
    let blockerSpawned = false;

    const agent = new FakeAgent((context) => {
      if (context.task.id === "t2") {
        return { success: true, summary: "resolved prerequisite" };
      }
      if (!blockerSpawned) {
        blockerSpawned = true;
        context.graph.spawnTask("t1", {
          id: "t2",
          title: "blocker",
          description: "must happen first",
          reason: "missing prerequisite"
        });
        return { success: false, summary: "blocked" };
      }
      return { success: true, summary: "finished for real" };
    });
    const reviewer = new FakeReviewer([
      { approved: true, feedback: "child looks good" },
      { approved: true, feedback: "parent looks good" }
    ]);

    await new MissionRunner(graph, { agent, reviewer }).run();

    expect(graph.getTask("t2")?.status).toBe("COMPLETED");
    expect(graph.getTask("t1")?.status).toBe("COMPLETED");
  });

  it("checkpoints before running a task and stores the checkpoint id", async () => {
    const graph = new TaskGraph([makeTask()]);
    const agent = new FakeAgent(() => ({ success: true, summary: "done" }));
    const reviewer = new FakeReviewer([{ approved: true, feedback: "looks good" }]);
    const checkpointer = new FakeCheckpointer();

    await new MissionRunner(graph, { agent, reviewer, checkpointer }).run();

    expect(checkpointer.created).toEqual(["cp-1:before t1"]);
    expect(graph.getTask("t1")?.checkpointId).toBe("cp-1");
    expect(checkpointer.restored).toEqual([]);
  });

  it("restores the checkpoint when a review is rejected", async () => {
    const graph = new TaskGraph([makeTask()]);
    const agent = new FakeAgent(() => ({ success: true, summary: "attempt" }));
    const reviewer = new FakeReviewer([
      { approved: false, feedback: "missing tests" },
      { approved: true, feedback: "now it is fine" }
    ]);
    const checkpointer = new FakeCheckpointer();

    await new MissionRunner(graph, { agent, reviewer, checkpointer }).run();

    expect(checkpointer.created).toEqual(["cp-1:before t1", "cp-2:before t1"]);
    expect(checkpointer.restored).toEqual(["cp-1"]);
    expect(graph.getTask("t1")?.status).toBe("COMPLETED");
  });

  it("does not restore a checkpoint when the task is blocked instead of reviewed", async () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "READY" })]);
    const agent = new FakeAgent((context) => {
      context.graph.spawnTask("t1", {
        id: "t2",
        title: "blocker",
        description: "must happen first",
        reason: "missing prerequisite"
      });
      return { success: false, summary: "blocked" };
    });
    const reviewer: Reviewer = {
      review: () => {
        throw new Error("reviewer should not be called while blocked");
      }
    };
    const checkpointer = new FakeCheckpointer();

    const runner = new MissionRunner(graph, { agent, reviewer, checkpointer });
    await runner.step("t1");

    expect(checkpointer.created).toEqual(["cp-1:before t1"]);
    expect(checkpointer.restored).toEqual([]);
  });
});
