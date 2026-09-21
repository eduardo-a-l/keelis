import { describe, expect, it } from "vitest";
import { canTransition, isReady, isTerminal, type Task } from "../../src/core/task.js";

describe("canTransition", () => {
  it("allows READY to RUNNING", () => {
    expect(canTransition("READY", "RUNNING")).toBe(true);
  });

  it("rejects COMPLETED to RUNNING", () => {
    expect(canTransition("COMPLETED", "RUNNING")).toBe(false);
  });
});

describe("isTerminal", () => {
  it("treats COMPLETED and CANCELLED as terminal", () => {
    expect(isTerminal("COMPLETED")).toBe(true);
    expect(isTerminal("CANCELLED")).toBe(true);
    expect(isTerminal("RUNNING")).toBe(false);
  });
});

describe("isReady", () => {
  const baseTask: Task = {
    id: "t2",
    missionId: "m1",
    title: "second",
    description: "",
    status: "QUEUED",
    dependsOn: ["t1"],
    createdBy: "planner",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z"
  };

  it("is not ready when a dependency is incomplete", () => {
    expect(isReady(baseTask, new Set())).toBe(false);
  });

  it("is ready once all dependencies are completed", () => {
    expect(isReady(baseTask, new Set(["t1"]))).toBe(true);
  });
});
