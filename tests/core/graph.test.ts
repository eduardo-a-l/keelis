import { describe, expect, it } from "vitest";
import { TaskGraph } from "../../src/core/graph.js";
import type { Task } from "../../src/core/task.js";

function makeTask(overrides: Partial<Task> = {}): Task {
  const now = new Date().toISOString();
  return {
    id: "t1",
    missionId: "m1",
    title: "task",
    description: "",
    status: "QUEUED",
    dependsOn: [],
    createdBy: "planner",
    createdAt: now,
    updatedAt: now,
    ...overrides
  };
}

describe("TaskGraph.getRunnableTasks", () => {
  it("promotes and returns a queued task with no dependencies", () => {
    const graph = new TaskGraph([makeTask()]);
    const runnable = graph.getRunnableTasks();
    expect(runnable.map((task) => task.id)).toEqual(["t1"]);
    expect(graph.getTask("t1")?.status).toBe("READY");
  });

  it("does not promote a task with an incomplete dependency", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1" }),
      makeTask({ id: "t2", dependsOn: ["t1"] })
    ]);
    expect(graph.getRunnableTasks().map((task) => task.id)).toEqual(["t1"]);
  });

  it("promotes the dependent task once its dependency completes", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1", status: "COMPLETED" }),
      makeTask({ id: "t2", dependsOn: ["t1"] })
    ]);
    expect(graph.getRunnableTasks().map((task) => task.id)).toEqual(["t2"]);
  });

  it("re-promotes a task sent back to READY after a failed review", () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "RUNNING" })]);
    graph.transition("t1", "FAILED");
    graph.transition("t1", "READY");
    expect(graph.getRunnableTasks().map((task) => task.id)).toEqual(["t1"]);
  });
});

describe("TaskGraph.spawnTask", () => {
  it("blocks the parent and adds a dependency", () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "RUNNING" })]);
    const child = graph.spawnTask("t1", {
      id: "t2",
      title: "child",
      description: "",
      reason: "needed"
    });

    expect(graph.getTask("t1")?.status).toBe("BLOCKED");
    expect(graph.getTask("t1")?.dependsOn).toContain("t2");
    expect(child.status).toBe("QUEUED");
  });

  it("unblocks the parent once the spawned child completes", () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "RUNNING" })]);
    graph.spawnTask("t1", { id: "t2", title: "child", description: "", reason: "needed" });
    graph.transition("t2", "READY");
    graph.transition("t2", "RUNNING");
    graph.transition("t2", "COMPLETED");

    expect(graph.getRunnableTasks().map((task) => task.id)).toEqual(["t1"]);
  });
});

describe("TaskGraph.transition", () => {
  it("rejects invalid transitions", () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "COMPLETED" })]);
    expect(() => graph.transition("t1", "RUNNING")).toThrow();
  });
});

describe("TaskGraph.updateTask", () => {
  it("merges attempts and review feedback onto the task", () => {
    const graph = new TaskGraph([makeTask({ id: "t1" })]);
    graph.updateTask("t1", { attempts: 2, lastReviewFeedback: "needs more detail" });
    const task = graph.getTask("t1");
    expect(task?.attempts).toBe(2);
    expect(task?.lastReviewFeedback).toBe("needs more detail");
  });
});

describe("TaskGraph.isMissionComplete", () => {
  it("is true once every task is terminal", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1", status: "COMPLETED" }),
      makeTask({ id: "t2", status: "CANCELLED" })
    ]);
    expect(graph.isMissionComplete()).toBe(true);
  });
});
