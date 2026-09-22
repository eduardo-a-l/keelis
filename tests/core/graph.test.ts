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

describe("TaskGraph", () => {
  it("returns ready tasks with no dependencies", () => {
    const graph = new TaskGraph([makeTask()]);
    expect(graph.getReadyTasks().map((task) => task.id)).toEqual(["t1"]);
  });

  it("does not return tasks with incomplete dependencies", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1" }),
      makeTask({ id: "t2", dependsOn: ["t1"] })
    ]);
    expect(graph.getReadyTasks().map((task) => task.id)).toEqual(["t1"]);
  });

  it("returns the dependent task once its dependency completes", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1", status: "COMPLETED" }),
      makeTask({ id: "t2", dependsOn: ["t1"] })
    ]);
    expect(graph.getReadyTasks().map((task) => task.id)).toEqual(["t2"]);
  });

  it("spawnTask blocks the parent and adds a dependency", () => {
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

  it("rejects invalid transitions", () => {
    const graph = new TaskGraph([makeTask({ id: "t1", status: "COMPLETED" })]);
    expect(() => graph.transition("t1", "RUNNING")).toThrow();
  });

  it("reports mission completion once every task is terminal", () => {
    const graph = new TaskGraph([
      makeTask({ id: "t1", status: "COMPLETED" }),
      makeTask({ id: "t2", status: "CANCELLED" })
    ]);
    expect(graph.isMissionComplete()).toBe(true);
  });
});
